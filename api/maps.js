/**
 * GET /api/maps?mode=forward&address=...  (also /api/geocode-address via rewrite)
 * GET /api/maps?mode=reverse&lat=...&lng=...  (also /api/reverse-geocode via rewrite)
 */

function forwardGeocode(req, res) {
  res.setHeader('Cache-Control', 's-maxage=604800')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = String(req.query.address || '').trim()
  if (!address) {
    return res.status(400).json({ error: 'address query parameter is required' })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key is missing' })
  }

  return (async () => {
    try {
      const params = new URLSearchParams({ address, key: apiKey, region: 'in' })
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
      )
      const data = await response.json()

      if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
        return res.status(404).json({ error: 'Address could not be geocoded' })
      }

      const { lat, lng } = data.results[0].geometry.location
      return res.status(200).json({
        lat: Number(lat),
        lng: Number(lng),
        formattedAddress: data.results[0].formatted_address || null,
      })
    } catch (error) {
      console.error('Forward geocode error:', error)
      return res.status(502).json({ error: 'Could not geocode address' })
    }
  })()
}

function reverseGeocode(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { lat, lng } = req.query
  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API key is missing' })
  }

  return (async () => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status !== 'OK' || !data.results?.length) {
        return res.status(404).json({ city: 'Unknown Location' })
      }

      let city = 'Unknown Location'
      for (const result of data.results) {
        for (const component of result.address_components) {
          if (component.types.includes('locality')) {
            city = component.long_name
            break
          }
        }
        if (city !== 'Unknown Location') break
      }

      if (city === 'Unknown Location') {
        for (const result of data.results) {
          for (const component of result.address_components) {
            if (component.types.includes('administrative_area_level_2')) {
              city = component.long_name
              break
            }
          }
          if (city !== 'Unknown Location') break
        }
      }

      return res.status(200).json({ city })
    } catch (error) {
      console.error('Reverse geocode error:', error)
      return res.status(502).json({ error: 'Could not fetch location data' })
    }
  })()
}

export default function handler(req, res) {
  const mode = String(req.query.mode || '').toLowerCase()
  if (mode === 'reverse' || (req.query.lat && req.query.lng && !req.query.address)) {
    return reverseGeocode(req, res)
  }
  return forwardGeocode(req, res)
}
