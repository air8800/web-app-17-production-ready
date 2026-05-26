/**
 * POST /api/driving-distances
 * Body: { origin: { lat, lng }, destinations: [{ lat, lng }, ...] }
 * Returns road driving distances in km.
 * Implements Supabase Database caching to save paid routing API costs.
 */

import { createClient } from '@supabase/supabase-js'

const OLA_DISTANCE_MATRIX = 'https://api.olamaps.io/routing/v1/distanceMatrix'
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'
const configuredMaxDestinations = Number.parseInt(process.env.DISTANCE_MATRIX_MAX_DESTINATIONS || '50', 10)
const MAX_DESTINATIONS = Number.isFinite(configuredMaxDestinations) && configuredMaxDestinations > 0
  ? configuredMaxDestinations
  : 50

// Initialize Supabase (Using standard process.env for Vercel backend)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

// Round to 2 decimal places (~1.1 kilometers accuracy) to group neighborhood requests
function roundCoord(num) {
  return Math.round(num * 100) / 100
}

async function olaDrivingDistancesKm(origin, destinations, apiKey) {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
    mode: 'driving',
    route_preference: 'fastest',
    api_key: apiKey
  })

  const resp = await fetch(`${OLA_DISTANCE_MATRIX}?${params.toString()}`, {
    headers: {
      'x-request-id': `printget-${Date.now()}`,
      'x-correlation-id': 'printget-driving-distances'
    }
  })

  if (!resp.ok) {
    const errorText = await resp.text()
    throw new Error(`Ola Distance Matrix request failed: ${resp.status} - ${errorText}`)
  }

  const data = await resp.json()
  const elements = data?.rows?.[0]?.elements
  if (!Array.isArray(elements)) {
    throw new Error('Ola Distance Matrix did not return rows[0].elements')
  }

  return destinations.map((_, index) => {
    const el = elements[index]
    const isOk = !el?.status || String(el.status).toUpperCase() === 'OK'
    const meters = Number(el?.distance)
    return isOk && Number.isFinite(meters) ? meters / 1000 : null
  })
}

async function osrmDrivingDistancesKm(origin, destinations) {
  const coordStr = [
    `${origin.lng},${origin.lat}`,
    ...destinations.map((d) => `${d.lng},${d.lat}`),
  ].join(';')

  const url = `${OSRM_TABLE}/${coordStr}?sources=0&annotations=distance`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.code !== 'Ok' || !data.distances?.[0]) {
    throw new Error(data.message || 'OSRM table request failed')
  }

  return data.distances[0].slice(1).map((meters) =>
    Number.isFinite(meters) ? meters / 1000 : null
  )
}

async function fetchPaidDistancesKm(origin, destinations, { olaKey }) {
  const distances = []

  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS) {
    const chunk = destinations.slice(i, i + MAX_DESTINATIONS)
    const chunkDistances = await olaDrivingDistancesKm(origin, chunk, olaKey)
    distances.push(...chunkDistances)
  }

  return { distances, provider: 'ola' }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { origin, destinations } = req.body || {}
  const originLat = parseFloat(origin?.lat)
  const originLng = parseFloat(origin?.lng)

  if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !Array.isArray(destinations)) {
    return res.status(400).json({ error: 'origin and destinations are required' })
  }

  const dests = destinations
    .map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lng) }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))

  if (dests.length === 0) {
    return res.status(400).json({ error: 'No valid destinations' })
  }

  const olaKey = process.env.OLA_MAPS_API_KEY
  const originLatRounded = roundCoord(originLat)
  const originLngRounded = roundCoord(originLng)

  try {
    if (olaKey) {
      let responseProvider = 'ola'
      let finalDistances = new Array(dests.length).fill(null)
      let destinationsToFetch = []
      let fetchIndices = [] // To map back which index the fetched dest belongs to

      // 1. Try to fetch from Supabase cache first
      if (supabase) {
        try {
          const { data: cachedData, error } = await supabase
            .from('distance_cache')
            .select('*')
            .eq('origin_lat_rounded', originLatRounded)
            .eq('origin_lng_rounded', originLngRounded)
          
          if (!error && cachedData && cachedData.length > 0) {
            dests.forEach((d, index) => {
              const dLatRounded = roundCoord(d.lat)
              const dLngRounded = roundCoord(d.lng)
              const match = cachedData.find(c => 
                c.destination_lat_rounded === dLatRounded && 
                c.destination_lng_rounded === dLngRounded
              )
              if (match) {
                finalDistances[index] = Number(match.distance_km)
              } else {
                destinationsToFetch.push(d)
                fetchIndices.push(index)
              }
            })
          } else {
            // No cache hit at all, fetch all
            destinationsToFetch = [...dests]
            fetchIndices = dests.map((_, i) => i)
          }
        } catch (dbError) {
          console.error('Supabase cache read error:', dbError)
          destinationsToFetch = [...dests]
          fetchIndices = dests.map((_, i) => i)
        }
      } else {
        destinationsToFetch = [...dests]
        fetchIndices = dests.map((_, i) => i)
      }

      // 2. Fetch missing routes from the configured paid routing provider.
      if (destinationsToFetch.length > 0) {
        const fetched = await fetchPaidDistancesKm(
          { lat: originLat, lng: originLng },
          destinationsToFetch,
          { olaKey }
        )
        const fetchedDistances = fetched.distances
        responseProvider = fetched.provider

        const recordsToInsert = []

        fetchedDistances.forEach((dist, i) => {
          const originalIndex = fetchIndices[i]
          finalDistances[originalIndex] = dist

          if (dist !== null && supabase) {
            const dest = destinationsToFetch[i]
            recordsToInsert.push({
              origin_lat_rounded: originLatRounded,
              origin_lng_rounded: originLngRounded,
              destination_lat_rounded: roundCoord(dest.lat),
              destination_lng_rounded: roundCoord(dest.lng),
              distance_km: roundCoord(dist)
            })
          }
        })

        // 3. Save new distances to Supabase cache asynchronously
        if (recordsToInsert.length > 0) {
          // Fire and forget (don't await) so we don't slow down the user response
          supabase
            .from('distance_cache')
            .upsert(recordsToInsert, { onConflict: 'origin_lat_rounded,origin_lng_rounded,destination_lat_rounded,destination_lng_rounded' })
            .then(({ error }) => {
              if (error) console.error('Supabase cache write error:', error)
            })
            .catch(err => console.error('Supabase cache write exception:', err))
        }
      }

      return res.status(200).json({ distancesKm: finalDistances, provider: `${responseProvider}_cached` })
    }

    // Fallback to OSRM if no paid routing key is configured.
    const distancesKm = await osrmDrivingDistancesKm(
      { lat: originLat, lng: originLng },
      dests
    )
    return res.status(200).json({ distancesKm, provider: 'osrm' })
  } catch (err) {
    console.error('driving-distances error:', err)
    return res.status(502).json({ error: 'Could not compute driving distances' })
  }
}
