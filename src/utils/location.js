const EARTH_RADIUS_KM = 6371

export const USER_LOCATION_STORAGE_KEY = 'printget_user_location'

/** @returns {{ lat: number, lng: number } | null} */
export function getShopCoords(shop) {
  const lat = parseFloat(shop?.latitude)
  const lng = parseFloat(shop?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** @returns {number | null} distance in km */
export function distanceKm(userLat, userLng, shopLat, shopLng) {
  if (
    !Number.isFinite(userLat) ||
    !Number.isFinite(userLng) ||
    !Number.isFinite(shopLat) ||
    !Number.isFinite(shopLng)
  ) {
    return null
  }

  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(shopLat - userLat)
  const dLng = toRad(shopLng - userLng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(userLat)) * Math.cos(toRad(shopLat)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/** @param {number} km */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`
  if (km < 10) return `${km.toFixed(1)} km away`
  return `${Math.round(km)} km away`
}

export function getDistanceLabel(userLocation, shop) {
  const coords = getShopCoords(shop)
  if (!userLocation || !coords) return null
  const km = distanceKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
  return formatDistance(km)
}

/** @returns {number | null} */
export function getDistanceKm(userLocation, shop) {
  const coords = getShopCoords(shop)
  if (!userLocation || !coords) return null
  return distanceKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
}

export function getGoogleMapsDirectionsUrl(shop) {
  const coords = getShopCoords(shop)
  if (coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
  }
  if (shop?.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shop.address)}`
  }
  return null
}

/** @returns {{ lat: number, lng: number } | null} */
export function loadStoredUserLocation() {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const lat = parseFloat(parsed?.lat)
    const lng = parseFloat(parsed?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

export function storeUserLocation(location) {
  localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(location))
}

export function sortShopsByDistance(shops, userLocation) {
  if (!userLocation) return [...shops]

  return [...shops].sort((a, b) => {
    const aKm = getDistanceKm(userLocation, a)
    const bKm = getDistanceKm(userLocation, b)
    const aHas = aKm != null
    const bHas = bKm != null
    if (aHas && bHas) return aKm - bKm
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
}
