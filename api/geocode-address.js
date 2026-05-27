/**
 * GET /api/geocode-address?address=...
 * Forward-geocodes a shop address to lat/lng (Google Geocoding API).
 */

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=604800') // 7 days — shop addresses rarely move

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

  try {
    const params = new URLSearchParams({
      address,
      key: apiKey,
      region: 'in',
    })
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      console.warn('Forward geocode warning:', data.status, data.error_message)
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
}
