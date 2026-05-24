import { useCallback, useEffect, useState } from 'react'
import {
  isGeolocationSupported,
  isSecureContextForGeolocation,
  isStoredLocationStale,
  loadStoredUserLocation,
  queryGeolocationPermission,
  requestAccurateUserLocation,
  storeUserLocation,
  USER_LOCATION_STORAGE_KEY,
} from '../utils/location'

/**
 * Accurate user location with silent refresh when permission is already granted.
 */
export function useUserLocation({ autoRefresh = true } = {}) {
  const [userLocation, setUserLocation] = useState(() => loadStoredUserLocation())
  const [status, setStatus] = useState(() => (loadStoredUserLocation() ? 'ready' : 'idle'))
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
      const loc = await requestAccurateUserLocation()
      setUserLocation(loc)
      storeUserLocation(loc)
      setStatus('ready')
      setError(null)
      return loc
    } catch (err) {
      if (!silent) {
        setStatus('error')
        if (err.code === 1) {
          setError(
            'Location blocked. Tap the lock icon in your browser address bar → Site settings → Allow location, then try again.'
          )
        } else if (err.code === 3) {
          setError('Location timed out. Try again or move near a window.')
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

    const maybeRefresh = async (silent) => {
      if (cancelled) return
      const permission = await queryGeolocationPermission()
      const stored = loadStoredUserLocation()
      if (permission === 'granted' || stored) {
        await requestLocation({ silent })
      }
    }

    maybeRefresh(true)

    const onFocus = () => {
      if (isStoredLocationStale()) {
        maybeRefresh(true)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isStoredLocationStale()) {
        maybeRefresh(true)
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
