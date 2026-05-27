import { useEffect, useMemo, useState } from 'react'
import { fetchDrivingDistancesKm, getShopCoords, distanceKm } from '../utils/location'

const INITIAL_EXACT_DISTANCE_LIMIT = 50
const DISTANCE_CACHE_PREFIX = 'printget_distances_v4_google'

function shopsKey(shops) {
  return shops
    .map((s) => {
      const c = getShopCoords(s)
      return c
        ? `${s.id}:${roundCoord(c.lat, 4)},${roundCoord(c.lng, 4)}`
        : String(s.id)
    })
    .sort()
    .join(',')
}

function roundCoord(num, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(num * factor) / factor
}

/**
 * Straight-line first + paid matrix refinement:
 * 1. Checks localStorage for a fresh (1 hour) route cache for the user's neighborhood.
 * 2. Calculates free straight-line distances for all shops to rank nearby shops.
 * 3. Uses the paid matrix provider for the nearest batch only.
 * 4. Expands that exact-distance batch when the UI reveals more shops.
 * 5. Saves final combined distances to localStorage.
 */
export function useDrivingDistances(
  userLocation,
  shops,
  exactDistanceLimit = INITIAL_EXACT_DISTANCE_LIMIT,
  { coordsReady = true } = {}
) {
  const [distancesByShopId, setDistancesByShopId] = useState({})
  const [loading, setLoading] = useState(false)

  const shopsWithCoords = useMemo(
    () => (shops || []).filter((shop) => shop?.id && getShopCoords(shop)),
    [shops]
  )

  const key = shopsKey(shopsWithCoords)
  const originLat = userLocation?.lat
  const originLng = userLocation?.lng
  const paidLimit = Math.max(INITIAL_EXACT_DISTANCE_LIMIT, Number(exactDistanceLimit) || 0)

  useEffect(() => {
    if (
      !coordsReady ||
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      shopsWithCoords.length === 0
    ) {
      if (!coordsReady) setLoading(true)
      else {
        setDistancesByShopId({})
        setLoading(false)
      }
      return
    }

    const cacheKey = `${DISTANCE_CACHE_PREFIX}_${roundCoord(originLat)}_${roundCoord(originLng)}_${paidLimit}_${key}`
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
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

      shopsWithCoords.forEach((shop) => {
        const dest = getShopCoords(shop)
        const straightKm = distanceKm(originLat, originLng, dest.lat, dest.lng)
        if (straightKm != null && Number.isFinite(straightKm)) {
          next[shop.id] = straightKm
          shopDistances.push({ shop, km: straightKm })
        }
      })

      if (cancelled) return

      shopDistances.sort((a, b) => a.km - b.km)
      const exactShops = shopDistances.slice(0, paidLimit).map((s) => s.shop)

      if (!cancelled && Object.keys(next).length > 0) {
        setDistancesByShopId({ ...next })
      }

      if (exactShops.length > 0) {
        try {
          const exactDestinations = exactShops.map((shop) => {
            const coords = getShopCoords(shop)
            return { shopId: shop.id, lat: coords.lat, lng: coords.lng }
          })
          const { distancesByShopId: paidByShopId } = await fetchDrivingDistancesKm(
            origin,
            exactDestinations
          )

          if (cancelled) return

          exactShops.forEach((shop) => {
            const km = paidByShopId?.[shop.id]
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

        if (Object.keys(next).length > 0) {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                timestamp: Date.now(),
                distances: next,
              })
            )
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
  }, [originLat, originLng, key, paidLimit, shopsWithCoords, coordsReady])

  return { distancesByShopId, loading }
}
