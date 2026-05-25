import { useEffect, useMemo, useState } from 'react'
import { enrichShopWithCoordinates, fetchDrivingDistancesKm, getShopCoords, distanceKm } from '../utils/location'

const INITIAL_EXACT_DISTANCE_LIMIT = 50

function shopsKey(shops) {
  return shops
    .map((s) => s.id)
    .sort()
    .join(',')
}

function roundCoord(num) {
  return Math.round(num * 100) / 100
}

/**
 * Straight-line first + paid matrix refinement:
 * 1. Checks localStorage for a fresh (1 hour) route cache for the user's neighborhood.
 * 2. Calculates free straight-line distances for all shops to rank nearby shops.
 * 3. Uses the paid matrix provider for the nearest batch only.
 * 4. Expands that exact-distance batch when the UI reveals more shops.
 * 5. Saves final combined distances to localStorage.
 */
export function useDrivingDistances(userLocation, shops, exactDistanceLimit = INITIAL_EXACT_DISTANCE_LIMIT) {
  const [distancesByShopId, setDistancesByShopId] = useState({})
  const [loading, setLoading] = useState(false)

  const shopsWithCoords = useMemo(
    () =>
      (shops || [])
        .map(enrichShopWithCoordinates)
        .filter((shop) => getShopCoords(shop)),
    [shops]
  )

  const key = shopsKey(shopsWithCoords)
  const originLat = userLocation?.lat
  const originLng = userLocation?.lng
  const paidLimit = Math.max(INITIAL_EXACT_DISTANCE_LIMIT, Number(exactDistanceLimit) || 0)

  useEffect(() => {
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || shopsWithCoords.length === 0) {
      setDistancesByShopId({})
      setLoading(false)
      return
    }

    // 1. Check frontend localStorage Cache
    const cacheKey = `printget_distances_v2_${roundCoord(originLat)}_${roundCoord(originLng)}_${paidLimit}_${key}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        // 1-hour expiration AND ensure it actually has valid calculated distances
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000 && Object.keys(parsed.distances).length > 0) {
          setDistancesByShopId(parsed.distances)
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.warn('Frontend distance cache read failed', e)
    }

    let cancelled = false
    setLoading(true)

    const run = async () => {
      const next = {}
      const origin = { lat: originLat, lng: originLng }
      const shopDistances = []

      // 2. Free straight-line distance for every shop. This gives us a cheap
      // nearby-first order before spending paid matrix requests.
      shopsWithCoords.forEach((shop) => {
        const dest = getShopCoords(shop)
        const straightKm = distanceKm(originLat, originLng, dest.lat, dest.lng)
        if (straightKm != null && Number.isFinite(straightKm)) {
          next[shop.id] = straightKm
          shopDistances.push({ shop, km: straightKm })
        }
      })

      if (cancelled) return

      // Sort by free distance and refine the nearest batch with Ola/paid matrix.
      shopDistances.sort((a, b) => a.km - b.km)
      const exactShops = shopDistances.slice(0, paidLimit).map(s => s.shop)

      // Show and sort by free straight-line distance immediately while exact
      // road distances are being refined for the nearest batch.
      if (!cancelled && Object.keys(next).length > 0) {
        setDistancesByShopId({ ...next })
      }

      // 3. Fetch paid provider exact distance only for shops the user is likely to see.
      if (exactShops.length > 0) {
        try {
          const exactDestinations = exactShops.map((shop) => getShopCoords(shop))
          const exactDistancesKm = await fetchDrivingDistancesKm(origin, exactDestinations)
          
          if (cancelled) return

          exactShops.forEach((shop, idx) => {
            const km = exactDistancesKm?.[idx]
            // Overwrite the straight-line distance with the exact paid-provider distance.
            if (km != null && Number.isFinite(km)) {
              next[shop.id] = km
            }
          })
        } catch (e) {
          console.warn('Paid matrix batch fetch failed, keeping straight-line distances', e)
        }
      }

      if (!cancelled) {
        setDistancesByShopId(next)
        setLoading(false)

        // 5. Save combined distances to frontend cache ONLY if we successfully calculated routes
        if (Object.keys(next).length > 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              timestamp: Date.now(),
              distances: next
            }))
          } catch (e) {
            console.warn('Frontend distance cache write failed', e)
          }
        }
      }
    }

    run().catch((e) => {
      console.error('Hybrid routing error:', e)
      if (!cancelled) {
        setDistancesByShopId({})
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [originLat, originLng, key, paidLimit, shopsWithCoords])

  return { distancesByShopId, loading }
}
