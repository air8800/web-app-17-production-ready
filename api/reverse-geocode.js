/**
 * GET /api/reverse-geocode
 * Query params: lat, lng
 * Returns the city/locality name for the given coordinates using Google Maps Geocoding API.
 */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=86400') // Cache at Edge for 1 day since city boundaries don't change

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

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('Geocoding API warning:', data.status, data.error_message)
      return res.status(404).json({ city: 'Unknown Location' })
    }

    // Attempt to extract the city (locality)
    let city = 'Unknown Location'
    
    // Look for locality in address_components
    for (const result of data.results) {
      for (const component of result.address_components) {
        if (component.types.includes('locality')) {
          city = component.long_name
          break
        }
      }
      if (city !== 'Unknown Location') break
    }

    // Fallback to administrative_area_level_2 (often district/city in India)
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
    console.error('Reverse Geocode error:', error)
    return res.status(502).json({ error: 'Could not fetch location data' })
  }
}
