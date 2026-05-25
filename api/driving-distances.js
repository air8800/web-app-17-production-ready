/**
 * POST /api/driving-distances
 * Body: { origin: { lat, lng }, destinations: [{ lat, lng }, ...] }
 * Returns road driving distances in km (same mode Google Maps uses by default).
 */

const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'
const MAX_DESTINATIONS = 25

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
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE'
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

  // Maps back in the exact order of destinations passed in
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

  try {
    if (googleKey) {
      const distancesKm = await googleDrivingDistancesKm(
        { lat: originLat, lng: originLng },
        dests,
        googleKey
      )
      return res.status(200).json({ distancesKm, provider: 'google' })
    }

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
