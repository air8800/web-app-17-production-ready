import { SHOP_COORDINATE_FALLBACKS } from '../data/shopCoordinates'

const EARTH_RADIUS_KM = 6371
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'

export const USER_LOCATION_STORAGE_KEY = 'printget_user_location'
export const LOCATION_MAX_AGE_MS = 2 * 60 * 1000

/** @returns {{ lat: number, lng: number } | null} */
export function getShopCoords(shop) {
  const lat = parseFloat(shop?.latitude)
  const lng = parseFloat(shop?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Merge DB coords or known fallbacks so distance/maps work before SQL seed runs. */
export function enrichShopWithCoordinates(shop) {
  if (!shop) return shop
  if (getShopCoords(shop)) return shop
  const fallback = SHOP_COORDINATE_FALLBACKS[shop.id]
  if (!fallback) return shop
  return { ...shop, latitude: fallback.latitude, longitude: fallback.longitude }
}

/** @returns {number | null} straight-line distance in km (legacy fallback only) */
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

/** Driving distance label when km is known; otherwise null while loading. */
export function getDrivingDistanceLabel(drivingKm, { loading = false } = {}) {
  if (drivingKm != null && Number.isFinite(drivingKm)) {
    return formatDistance(drivingKm)
  }
  if (loading) return 'Calculating route…'
  return null
}

/** @returns {number | null} */
export function getDrivingDistanceKm(distancesByShopId, shopId) {
  const km = distancesByShopId?.[shopId]
  return km != null && Number.isFinite(km) ? km : null
}

/**
 * Turn-by-turn using the same origin/destination pair as distance calculations.
 * @param {object} shop
 * @param {{ lat: number, lng: number } | null | undefined} userLocation
 */
export function getGoogleMapsDirectionsUrl(shop, userLocation) {
  const enriched = enrichShopWithCoordinates(shop)
  const coords = getShopCoords(enriched)
  if (!coords) return null

  const params = new URLSearchParams({
    api: '1',
    destination: `${coords.lat},${coords.lng}`,
    travelmode: 'driving',
  })

  if (userLocation?.lat != null && userLocation?.lng != null) {
    params.set('origin', `${userLocation.lat},${userLocation.lng}`)
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** @returns {{ lat: number, lng: number, updatedAt?: number } | null} */
export function loadStoredUserLocation() {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const lat = parseFloat(parsed?.lat)
    const lng = parseFloat(parsed?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const updatedAt = Number(parsed?.updatedAt)
    return {
      lat,
      lng,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function isStoredLocationStale(maxAgeMs = LOCATION_MAX_AGE_MS) {
  const stored = loadStoredUserLocation()
  if (!stored) return true
  if (!stored.updatedAt) return true
  return Date.now() - stored.updatedAt > maxAgeMs
}

export function storeUserLocation(location) {
  localStorage.setItem(
    USER_LOCATION_STORAGE_KEY,
    JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      updatedAt: Date.now(),
    })
  )
}

/** High-accuracy GPS fix for mobile. */
export function requestAccurateUserLocation() {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    )
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
    throw new Error(data.message || 'OSRM request failed')
  }

  return data.distances[0].slice(1).map((meters) =>
    Number.isFinite(meters) ? meters / 1000 : null
  )
}

/**
 * Road driving distances in km (same travel mode as Google Maps directions).
 * @returns {Promise<(number | null)[]>}
 */
export async function fetchDrivingDistancesKm(origin, destinations) {
  if (!origin || !destinations?.length) return []

  try {
    const resp = await fetch('/api/driving-distances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destinations }),
    })
    if (resp.ok) {
      const data = await resp.json()
      if (Array.isArray(data.distancesKm)) {
        return data.distancesKm
      }
    }
  } catch {
    // fall through to direct OSRM (local dev without /api)
  }

  return osrmDrivingDistancesKm(origin, destinations)
}

export function sortShopsByDrivingDistance(shops, distancesByShopId) {
  if (!distancesByShopId || Object.keys(distancesByShopId).length === 0) {
    return [...shops]
  }

  return [...shops].map(enrichShopWithCoordinates).sort((a, b) => {
    const aKm = getDrivingDistanceKm(distancesByShopId, a.id)
    const bKm = getDrivingDistanceKm(distancesByShopId, b.id)
    const aHas = aKm != null
    const bHas = bKm != null
    if (aHas && bHas) return aKm - bKm
    if (aHas) return -1
    if (bHas) return 1
    return 0
  })
}

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

export function isSecureContextForGeolocation() {
  if (typeof window === 'undefined') return true
  if (window.isSecureContext) return true
  const host = window.location?.hostname || ''
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

/** @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>} */
export async function queryGeolocationPermission() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown'
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state
  } catch {
    return 'unknown'
  }
}
