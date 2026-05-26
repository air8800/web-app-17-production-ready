import { useCallback, useEffect, useState } from 'react'
import {
  isGeolocationSupported,
  isSecureContextForGeolocation,
  isStoredLocationStale,
  isUserLocationStale,
  loadStoredUserLocation,
  LOCATION_COARSE_ACCURACY_M,
  LOCATION_TARGET_ACCURACY_M,
  queryGeolocationPermission,
  requestAccurateUserLocation,
  storeUserLocation,
  USER_LOCATION_STORAGE_KEY,
} from '../utils/location'

function getFreshStoredLocation() {
  const stored = loadStoredUserLocation()
  return stored && !isUserLocationStale(stored) ? stored : null
}

function getAccuracyWarning(location, { isMobile = isLikelyMobileDevice() } = {}) {
  if (!Number.isFinite(location?.accuracy)) {
    return null
  }
  if (location.accuracy <= LOCATION_TARGET_ACCURACY_M) {
    return null // Excellent GPS lock, no warning needed
  }
  if (location.accuracy <= LOCATION_COARSE_ACCURACY_M) {
    return null // Acceptable accuracy, no warning
  }
  if (!isMobile) {
    return 'Desktop location is approximate, so shop distances may not be exact. For the most accurate nearest-shop results, use your phone GPS.'
  }
  return `Location is only accurate within about ${Math.round(location.accuracy)} m. Move outdoors or near a window and tap Update my location for a better reading.`
}

function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
}

/**
 * Accurate user location with silent refresh when permission is already granted.
 */
export function useUserLocation({ autoRefresh = true } = {}) {
  const [userLocation, setUserLocation] = useState(() => getFreshStoredLocation())
  const [status, setStatus] = useState(() => (getFreshStoredLocation() ? 'ready' : 'idle'))
  const [error, setError] = useState(null)

  const requestLocation = useCallback(async ({ silent = false } = {}) => {
    if (!isGeolocationSupported()) {
      setStatus('error')
      setError('Location is not supported on this device.')
      return null
    }
    if (!isSecureContextForGeolocation()) {
      setStatus('error')
      setError(
        'Location needs HTTPS. Open https://www.printget.in or use localhost — not a local IP like 192.168.x.x.'
      )
      return null
    }

    if (!silent) {
      setStatus('loading')
      setError(null)
    }

    try {
      const isMobile = isLikelyMobileDevice()
      const loc = await requestAccurateUserLocation({
        maxAcceptableAccuracyM: 1000,
      })
      setUserLocation(loc)
      storeUserLocation(loc)
      setStatus('ready')
      setError(getAccuracyWarning(loc, { isMobile }))
      return loc
    } catch (err) {
      if (!silent) {
        setStatus('error')
        if (err.code === 1) {
          setError(
            'Location blocked. Tap the lock icon in your browser address bar → Site settings → Allow location, then try again.'
          )
        } else if (err.code === 2 || err.code === 4) {
          if (isLikelyMobileDevice()) {
            setError('Device GPS is off or unavailable. Please turn ON your device Location/GPS.')
            alert('Please turn ON your device Location / GPS in your phone settings to get accurate distances.')
          } else {
            setError(
              'Precise location could not be identified on this desktop. PC location can use Wi-Fi/IP and may jump to the wrong city. Please select your city manually, or use your phone for accurate nearest-shop distances.'
            )
          }
        } else if (err.code === 3) {
          setError('Location timed out. Try again or move outdoors.')
        } else {
          setError('Could not detect your location. Tap the button to try again.')
        }
      }
      return null
    }
  }, [])

  const clearLocation = useCallback(() => {
    setUserLocation(null)
    setStatus('idle')
    setError(null)
    localStorage.removeItem(USER_LOCATION_STORAGE_KEY)
  }, [])

  useEffect(() => {
    if (!autoRefresh) return undefined

    let cancelled = false

    const doFreshFix = async () => {
      if (cancelled) return
      const permission = await queryGeolocationPermission()
      const stored = loadStoredUserLocation()
      // Always request a fresh GPS fix when:
      // - Permission is already granted (no prompt will appear)
      // - OR we have a stored location (user consented before)
      if (permission === 'granted' || stored) {
        await requestLocation({ silent: true })
      }
    }

    // Always get a fresh GPS reading on mount — don't rely on cached location
    doFreshFix()

    // Also refresh when the tab regains focus (user switches back from another app)
    const onFocus = () => {
      doFreshFix()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        doFreshFix()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoRefresh, requestLocation])

  return {
    userLocation,
    status,
    error,
    requestLocation,
    clearLocation,
  }
}
