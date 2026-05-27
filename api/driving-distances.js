/**
 * POST /api/driving-distances
 * Body: { origin: { lat, lng }, destinations: [{ shopId?, lat, lng }, ...] }
 * Returns road driving distances in km.
 *
 * Default: Ola Distance Matrix. Fallback: Google → OSRM (only if Ola/key missing or fails).
 * Override with DISTANCE_ROUTING_PROVIDER=google|ola|osrm
 */

import { createClient } from '@supabase/supabase-js'

const GOOGLE_DISTANCE_MATRIX = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const OLA_DISTANCE_MATRIX = 'https://api.olamaps.io/routing/v1/distanceMatrix'
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'
const CACHE_VERSION = 3
const configuredMaxDestinations = Number.parseInt(process.env.DISTANCE_MATRIX_MAX_DESTINATIONS || '25', 10)
const GOOGLE_MAX_DESTINATIONS = 25
const OLA_MAX_DESTINATIONS = Number.parseInt(process.env.OLA_MATRIX_MAX_DESTINATIONS || '50', 10)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function roundCoord(num) {
  return Math.round(num * 100) / 100
}

/** Ola first when key is set; Google if Ola key missing; OSRM only via explicit env or failure. */
function resolvePrimaryProvider(googleKey, olaKey) {
  const forced = String(process.env.DISTANCE_ROUTING_PROVIDER || 'ola').toLowerCase()
  if (forced === 'osrm') return null
  if (forced === 'google' && googleKey) return 'google'
  if (forced === 'ola' && olaKey) return 'ola'
  if (olaKey) return 'ola'
  if (googleKey) return 'google'
  return null
}

function olaDistanceMeters(element) {
  if (!element) return null
  const raw = element.distance
  if (raw != null && typeof raw === 'object' && Number.isFinite(Number(raw.value))) {
    return Number(raw.value)
  }
  if (Number.isFinite(Number(raw))) {
    const n = Number(raw)
    // Values under 100 are usually km; Ola typically returns meters.
    return n < 100 ? n * 1000 : n
  }
  if (Number.isFinite(Number(element.distance_meters))) {
    return Number(element.distance_meters)
  }
  return null
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
    if (!isOk) return null
    const meters = olaDistanceMeters(el)
    return meters != null && Number.isFinite(meters) ? meters / 1000 : null
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

async function fetchPaidDistancesKm(origin, destinations, provider, { googleKey, olaKey }) {
  const distances = []

  if (provider === 'google' && googleKey) {
    const chunkSize = Math.min(
      GOOGLE_MAX_DESTINATIONS,
      Number.isFinite(configuredMaxDestinations) && configuredMaxDestinations > 0
        ? configuredMaxDestinations
        : GOOGLE_MAX_DESTINATIONS
    )
    for (let i = 0; i < destinations.length; i += chunkSize) {
      const chunk = destinations.slice(i, i + chunkSize)
      distances.push(...(await googleDrivingDistancesKm(origin, chunk, googleKey)))
    }
    return { distances, provider: 'google' }
  }

  if (provider === 'ola' && olaKey) {
    const chunkSize = Math.min(
      OLA_MAX_DESTINATIONS,
      Number.isFinite(configuredMaxDestinations) && configuredMaxDestinations > 0
        ? configuredMaxDestinations
        : OLA_MAX_DESTINATIONS
    )
    for (let i = 0; i < destinations.length; i += chunkSize) {
      const chunk = destinations.slice(i, i + chunkSize)
      distances.push(...(await olaDrivingDistancesKm(origin, chunk, olaKey)))
    }
    return { distances, provider: 'ola' }
  }

  throw new Error(`No API key for provider: ${provider}`)
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

  const buildResponse = (distancesKm, provider, extra = {}) => {
    const distancesByShopId = {}
    validDests.forEach((dest, index) => {
      distancesByShopId[dest.shopId] = distancesKm[index] ?? null
    })
    return res.status(200).json({
      distancesKm,
      distancesByShopId,
      provider,
      cacheVersion: CACHE_VERSION,
      ...extra,
    })
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY
  const olaKey = process.env.OLA_MAPS_API_KEY
  const primaryProvider = resolvePrimaryProvider(googleKey, olaKey)

  const originLatRounded = roundCoord(originLat)
  const originLngRounded = roundCoord(originLng)

  try {
    if (primaryProvider) {
      let responseProvider = primaryProvider
      let finalDistances = new Array(validDests.length).fill(null)
      let destinationsToFetch = [...validDests]
      let fetchIndices = validDests.map((_, i) => i)
      let cacheHit = false

      if (supabase) {
        try {
          const { data: cachedData, error } = await supabase
            .from('distance_cache')
            .select('*')
            .eq('origin_lat_rounded', originLatRounded)
            .eq('origin_lng_rounded', originLngRounded)
            .eq('routing_provider', primaryProvider)

          if (!error && cachedData?.length > 0) {
            destinationsToFetch = []
            fetchIndices = []
            validDests.forEach((d, index) => {
              const match = cachedData.find(
                (c) =>
                  c.destination_lat_rounded === roundCoord(d.lat) &&
                  c.destination_lng_rounded === roundCoord(d.lng)
              )
              if (match) {
                finalDistances[index] = Number(match.distance_km)
                cacheHit = true
              } else {
                destinationsToFetch.push(d)
                fetchIndices.push(index)
              }
            })
          }
        } catch (dbError) {
          console.error('Supabase distance cache read skipped:', dbError.message)
        }
      }

      if (destinationsToFetch.length > 0) {
        let fetched
        try {
          fetched = await fetchPaidDistancesKm(
            { lat: originLat, lng: originLng },
            destinationsToFetch,
            primaryProvider,
            { googleKey, olaKey }
          )
        } catch (primaryError) {
          if (primaryProvider === 'ola' && googleKey) {
            try {
              console.warn('Ola routing failed, trying Google:', primaryError.message)
              fetched = await fetchPaidDistancesKm(
                { lat: originLat, lng: originLng },
                destinationsToFetch,
                'google',
                { googleKey, olaKey }
              )
            } catch (googleError) {
              console.warn('Google routing failed, using OSRM:', googleError.message)
              const osrmDistances = await osrmDrivingDistancesKm(
                { lat: originLat, lng: originLng },
                destinationsToFetch
              )
              fetched = { distances: osrmDistances, provider: 'osrm' }
            }
          } else {
            console.warn(`${primaryProvider} routing failed, using OSRM:`, primaryError.message)
            const osrmDistances = await osrmDrivingDistancesKm(
              { lat: originLat, lng: originLng },
              destinationsToFetch
            )
            fetched = { distances: osrmDistances, provider: 'osrm' }
          }
        }

        responseProvider = fetched.provider
        const recordsToInsert = []

        fetched.distances.forEach((dist, i) => {
          const originalIndex = fetchIndices[i]
          finalDistances[originalIndex] = dist

          if (dist != null && supabase) {
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

      return buildResponse(finalDistances, cacheHit ? `${responseProvider}_cached` : responseProvider)
    }

    const distancesKm = await osrmDrivingDistancesKm(
      { lat: originLat, lng: originLng },
      validDests
    )
    return buildResponse(distancesKm, 'osrm')
  } catch (err) {
    console.error('driving-distances error:', err)
    return res.status(502).json({ error: 'Could not compute driving distances', details: err.message })
  }
}
