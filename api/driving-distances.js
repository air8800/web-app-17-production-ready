/**
 * POST /api/driving-distances
 * Body: { origin: { lat, lng }, destinations: [{ shopId?, lat, lng }, ...] }
 * Returns road driving distances in km.
 * Provider priority: Google Distance Matrix → Ola → OSRM.
 */

import { createClient } from '@supabase/supabase-js'

const GOOGLE_DISTANCE_MATRIX = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const OLA_DISTANCE_MATRIX = 'https://api.olamaps.io/routing/v1/distanceMatrix'
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'
const configuredMaxDestinations = Number.parseInt(process.env.DISTANCE_MATRIX_MAX_DESTINATIONS || '25', 10)
const GOOGLE_MAX_DESTINATIONS = 25
const OLA_MAX_DESTINATIONS = Number.parseInt(process.env.OLA_MATRIX_MAX_DESTINATIONS || '50', 10)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function roundCoord(num) {
  return Math.round(num * 100) / 100
}

async function googleDrivingDistancesKm(origin, destinations, apiKey) {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
    mode: 'driving',
    key: apiKey,
  })

  const resp = await fetch(`${GOOGLE_DISTANCE_MATRIX}?${params.toString()}`)
  const data = await resp.json()

  if (data.status !== 'OK') {
    throw new Error(`Google Distance Matrix failed: ${data.status} ${data.error_message || ''}`.trim())
  }

  const elements = data?.rows?.[0]?.elements
  if (!Array.isArray(elements)) {
    throw new Error('Google Distance Matrix did not return rows[0].elements')
  }

  return destinations.map((_, index) => {
    const el = elements[index]
    if (el?.status !== 'OK') return null
    const meters = Number(el?.distance?.value)
    return Number.isFinite(meters) ? meters / 1000 : null
  })
}

async function olaDrivingDistancesKm(origin, destinations, apiKey) {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: destinations.map((d) => `${d.lat},${d.lng}`).join('|'),
    mode: 'driving',
    route_preference: 'fastest',
    api_key: apiKey,
  })

  const resp = await fetch(`${OLA_DISTANCE_MATRIX}?${params.toString()}`, {
    headers: {
      'x-request-id': `printget-${Date.now()}`,
      'x-correlation-id': 'printget-driving-distances',
    },
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

async function fetchPaidDistancesKm(origin, destinations, { googleKey, olaKey }) {
  const distances = []

  if (googleKey) {
    const chunkSize = Math.min(
      GOOGLE_MAX_DESTINATIONS,
      Number.isFinite(configuredMaxDestinations) && configuredMaxDestinations > 0
        ? configuredMaxDestinations
        : GOOGLE_MAX_DESTINATIONS
    )
    for (let i = 0; i < destinations.length; i += chunkSize) {
      const chunk = destinations.slice(i, i + chunkSize)
      const chunkDistances = await googleDrivingDistancesKm(origin, chunk, googleKey)
      distances.push(...chunkDistances)
    }
    return { distances, provider: 'google' }
  }

  if (olaKey) {
    const chunkSize = Math.min(
      OLA_MAX_DESTINATIONS,
      Number.isFinite(configuredMaxDestinations) && configuredMaxDestinations > 0
        ? configuredMaxDestinations
        : OLA_MAX_DESTINATIONS
    )
    for (let i = 0; i < destinations.length; i += chunkSize) {
      const chunk = destinations.slice(i, i + chunkSize)
      const chunkDistances = await olaDrivingDistancesKm(origin, chunk, olaKey)
      distances.push(...chunkDistances)
    }
    return { distances, provider: 'ola' }
  }

  throw new Error('No paid routing key configured')
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

  const validDests = (destinations || [])
    .map((d, index) => ({
      shopId: d.shopId || d.id || `idx-${index}`,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lng),
    }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))

  if (validDests.length === 0) {
    return res.status(400).json({ error: 'No valid destinations' })
  }

  const buildResponse = (distancesKm, provider) => {
    const distancesByShopId = {}
    validDests.forEach((dest, index) => {
      distancesByShopId[dest.shopId] = distancesKm[index] ?? null
    })
    return res.status(200).json({ distancesKm, distancesByShopId, provider })
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY
  const olaKey = process.env.OLA_MAPS_API_KEY
  const routingProvider = googleKey ? 'google' : olaKey ? 'ola' : null
  const originLatRounded = roundCoord(originLat)
  const originLngRounded = roundCoord(originLng)

  try {
    if (routingProvider) {
      let responseProvider = routingProvider
      let finalDistances = new Array(validDests.length).fill(null)
      let destinationsToFetch = []
      let fetchIndices = []

      if (supabase) {
        try {
          let query = supabase
            .from('distance_cache')
            .select('*')
            .eq('origin_lat_rounded', originLatRounded)
            .eq('origin_lng_rounded', originLngRounded)
            .eq('routing_provider', routingProvider)

          const { data: cachedData, error } = await query

          if (!error && cachedData && cachedData.length > 0) {
            validDests.forEach((d, index) => {
              const dLatRounded = roundCoord(d.lat)
              const dLngRounded = roundCoord(d.lng)
              const match = cachedData.find(
                (c) =>
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
            destinationsToFetch = [...validDests]
            fetchIndices = validDests.map((_, i) => i)
          }
        } catch (dbError) {
          console.error('Supabase cache read error:', dbError)
          destinationsToFetch = [...validDests]
          fetchIndices = validDests.map((_, i) => i)
        }
      } else {
        destinationsToFetch = [...validDests]
        fetchIndices = validDests.map((_, i) => i)
      }

      if (destinationsToFetch.length > 0) {
        let fetched
        try {
          fetched = await fetchPaidDistancesKm(
            { lat: originLat, lng: originLng },
            destinationsToFetch,
            { googleKey, olaKey }
          )
        } catch (primaryError) {
          // Google failed → try Ola before giving up
          if (googleKey && olaKey) {
            console.warn('Google Distance Matrix failed, falling back to Ola:', primaryError.message)
            fetched = await fetchPaidDistancesKm(
              { lat: originLat, lng: originLng },
              destinationsToFetch,
              { googleKey: null, olaKey }
            )
            responseProvider = 'ola'
          } else {
            throw primaryError
          }
        }

        const fetchedDistances = fetched.distances
        responseProvider = fetched.provider

        const recordsToInsert = []

        fetchedDistances.forEach((dist, i) => {
          const originalIndex = fetchIndices[i]
          finalDistances[originalIndex] = dist

          if (dist !== null && supabase) {
            const dest = destinationsToFetch[i]
            recordsToInsert.push({
              routing_provider: responseProvider,
              origin_lat_rounded: originLatRounded,
              origin_lng_rounded: originLngRounded,
              destination_lat_rounded: roundCoord(dest.lat),
              destination_lng_rounded: roundCoord(dest.lng),
              distance_km: roundCoord(dist),
            })
          }
        })

        if (recordsToInsert.length > 0) {
          supabase
            .from('distance_cache')
            .upsert(recordsToInsert, {
              onConflict:
                'routing_provider,origin_lat_rounded,origin_lng_rounded,destination_lat_rounded,destination_lng_rounded',
            })
            .then(({ error }) => {
              if (error) console.error('Supabase cache write error:', error)
            })
            .catch((err) => console.error('Supabase cache write exception:', err))
        }
      }

      return buildResponse(finalDistances, `${responseProvider}_cached`)
    }

    const distancesKm = await osrmDrivingDistancesKm(
      { lat: originLat, lng: originLng },
      validDests
    )
    return buildResponse(distancesKm, 'osrm')
  } catch (err) {
    console.error('driving-distances error:', err)
    return res.status(502).json({ error: 'Could not compute driving distances' })
  }
}
