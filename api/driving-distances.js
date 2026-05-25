/**
 * POST /api/driving-distances
 * Body: { origin: { lat, lng }, destinations: [{ lat, lng }, ...] }
 * Returns road driving distances in km.
 * Implements Supabase Database caching to save Google Maps API costs.
 */

import { createClient } from '@supabase/supabase-js'

const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'
const MAX_DESTINATIONS = 25

// Initialize Supabase (Using standard process.env for Vercel backend)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null

// Round to 3 decimal places (~110 meters accuracy) to group neighborhood requests
function roundCoord(num) {
  return Math.round(num * 1000) / 1000
}

async function googleDrivingDistancesKm(origin, destinations, apiKey) {
  const url = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix'
  
  const requestBody = {
    origins: [
      {
        waypoint: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        }
      }
    ],
    destinations: destinations.map((d) => ({
      waypoint: {
        location: {
          latLng: {
            latitude: d.lat,
            longitude: d.lng
          }
        }
      }
    })),
    travelMode: 'DRIVE' // Using Essentials tier without TRAFFIC_AWARE
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,status'
    },
    body: JSON.stringify(requestBody)
  })

  if (!resp.ok) {
    const errorText = await resp.text()
    throw new Error(`Routes API request failed: ${resp.status} - ${errorText}`)
  }

  const data = await resp.json()
  if (!Array.isArray(data)) {
    throw new Error('Routes API did not return an array')
  }

  const sortedDistances = new Array(destinations.length).fill(null)
  for (const el of data) {
    const status = el.status
    const isOk = !status || status.code === undefined || status.code === 0
    if (isOk) {
      const destIndex = el.destinationIndex ?? 0
      if (el.distanceMeters != null) {
        sortedDistances[destIndex] = el.distanceMeters / 1000
      }
    }
  }

  return sortedDistances
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
    .slice(0, MAX_DESTINATIONS)
    .map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lng) }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))

  if (dests.length === 0) {
    return res.status(400).json({ error: 'No valid destinations' })
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY
  const originLatRounded = roundCoord(originLat)
  const originLngRounded = roundCoord(originLng)

  try {
    if (googleKey) {
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

      // 2. Fetch missing routes from Google Maps
      if (destinationsToFetch.length > 0) {
        const fetchedDistances = await googleDrivingDistancesKm(
          { lat: originLat, lng: originLng },
          destinationsToFetch,
          googleKey
        )

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

      return res.status(200).json({ distancesKm: finalDistances, provider: 'google_cached' })
    }

    // Fallback to OSRM if no Google Key
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
