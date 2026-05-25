import { SHOP_COORDINATE_FALLBACKS } from '../data/shopCoordinates'

const EARTH_RADIUS_KM = 6371
const OSRM_TABLE = 'https://router.project-osrm.org/table/v1/driving'

export const USER_LOCATION_STORAGE_KEY = 'printget_user_location'
export const LOCATION_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
export const LOCATION_TARGET_ACCURACY_M = 15
export const LOCATION_COARSE_ACCURACY_M = 100
export const LOCATION_FIX_TIMEOUT_MS = 20000
export const LOCATION_MIN_SAMPLES = 2

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

  // We deliberately do NOT send the `origin` parameter here.
  // This lets Google Maps automatically use the user's live device location
  // inside the Google Maps app natively.

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** @returns {{ lat: number, lng: number, accuracy?: number | null, capturedAt?: number, updatedAt?: number } | null} */
export function loadStoredUserLocation() {
  try {
    const raw = localStorage.getItem(USER_LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const lat = parseFloat(parsed?.lat)
    const lng = parseFloat(parsed?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const updatedAt = Number(parsed?.updatedAt)
    const accuracy = Number(parsed?.accuracy)
    const capturedAt = Number(parsed?.capturedAt)
    return {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      capturedAt: Number.isFinite(capturedAt) ? capturedAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    }
  } catch {
    return null
  }
}

export function isUserLocationStale(location, maxAgeMs = LOCATION_MAX_AGE_MS) {
  if (!location?.updatedAt) return true
  return Date.now() - location.updatedAt > maxAgeMs
}

export function isStoredLocationStale(maxAgeMs = LOCATION_MAX_AGE_MS) {
  const stored = loadStoredUserLocation()
  if (!stored) return true
  return isUserLocationStale(stored, maxAgeMs)
}

export function storeUserLocation(location) {
  const payload = {
    lat: location.lat,
    lng: location.lng,
    updatedAt: Date.now(),
  }

  if (Number.isFinite(location.accuracy)) {
    payload.accuracy = location.accuracy
  }
  if (Number.isFinite(location.capturedAt)) {
    payload.capturedAt = location.capturedAt
  }

  localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(payload))
}

function toUserLocation(position) {
  const accuracy = Number(position.coords?.accuracy)
  const capturedAt = Number(position.timestamp)

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
  }
}

function isBetterLocation(next, current) {
  if (!current) return true
  const nextAccuracy = Number.isFinite(next.accuracy) ? next.accuracy : Number.POSITIVE_INFINITY
  const currentAccuracy = Number.isFinite(current.accuracy) ? current.accuracy : Number.POSITIVE_INFINITY
  return nextAccuracy < currentAccuracy
}

/**
 * High-accuracy GPS fix for mobile.
 * Waits for the GPS chip to warm up and requires multiple consistent
 * readings before accepting — prevents premature lock on coarse Wi-Fi estimates.
 */
export function requestAccurateUserLocation({
  targetAccuracyM = LOCATION_TARGET_ACCURACY_M,
  timeoutMs = LOCATION_FIX_TIMEOUT_MS,
  minSamples = LOCATION_MIN_SAMPLES,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation not supported'))
      return
    }

    let settled = false
    let watchId = null
    let bestLocation = null
    let lastError = null
    let goodSampleCount = 0

    const cleanup = () => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      clearTimeout(timeoutId)
    }

    const finish = (location, error) => {
      if (settled) return
      settled = true
      cleanup()
      if (location) {
        // If the best location we found is extremely inaccurate (e.g. > 1000m),
        // it means the device GPS is likely off and we only got a coarse IP/cell estimate.
        // We reject it rather than showing completely wrong store distances.
        if (location.accuracy && location.accuracy > 1000) {
          const err = new Error('Device GPS appears to be turned off')
          err.code = 4 // Custom code for "too inaccurate / GPS off"
          reject(err)
        } else {
          resolve(location)
        }
      } else {
        reject(error || new Error('Location unavailable'))
      }
    }

    const timeoutId = setTimeout(() => {
      const timeoutError = new Error('Location timed out')
      timeoutError.code = 3
      // Even on timeout, return the best location we got (if any)
      finish(bestLocation, lastError || timeoutError)
    }, timeoutMs)

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = toUserLocation(position)

        if (isBetterLocation(location, bestLocation)) {
          bestLocation = location
        }

        // Only count readings that meet the accuracy threshold
        if (Number.isFinite(location.accuracy) && location.accuracy <= targetAccuracyM) {
          goodSampleCount++
          // Wait for enough consistent good readings before accepting
          // This prevents accepting the first coarse Wi-Fi result that
          // happens to claim < targetAccuracyM accuracy
          if (goodSampleCount >= minSamples) {
            finish(location)
          }
        } else {
          // Reset counter when we get a bad reading — GPS hasn't stabilized
          goodSampleCount = 0
        }
      },
      (err) => {
        lastError = err
        if (!bestLocation) {
          finish(null, err)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
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

const OSRM_ROUTE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Road distance for a single origin→destination via OSRM route API.
 * @returns {Promise<number | null>} distance in km, or null on failure
 */
async function osrmSingleRouteKm(origin, destination) {
  const coordStr = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const url = `${OSRM_ROUTE}/${coordStr}?overview=false`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.code !== 'Ok' || !data.routes?.[0]) return null
  const meters = data.routes[0].distance
  return Number.isFinite(meters) ? meters / 1000 : null
}

/**
 * Fetch road driving distance for a single shop (uses OSRM route API).
 * Useful as a fallback when batch table distances haven't loaded yet.
 * @returns {Promise<number | null>}
 */
export async function fetchSingleDrivingDistanceKm(origin, destination) {
  if (!origin || !destination) return null
  try {
    return await osrmSingleRouteKm(origin, destination)
  } catch {
    return null
  }
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

/** @returns {Promise<string | null>} */
export async function fetchCityFromCoordinates(lat, lng) {
  if (!lat || !lng) return null
  try {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.city || null
  } catch {
    return null
  }
}
