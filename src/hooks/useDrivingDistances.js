import { useEffect, useMemo, useState } from 'react'
import { fetchDrivingDistancesKm, getShopCoords, distanceKm } from '../utils/location'

const INITIAL_EXACT_DISTANCE_LIMIT = 50
const DISTANCE_CACHE_PREFIX = 'printget_distances_v6_noola'
const DISTANCE_CACHE_VERSION = 3

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
 * Road driving distances for shop cards (Google or OSRM on server; Ola disabled).
 * Straight-line is used only to pick which shops to refine — not shown as final distance.
 */
export function useDrivingDistances(
  userLocation,
  shops,
  exactDistanceLimit = INITIAL_EXACT_DISTANCE_LIMIT,
  { coordsReady = true } = {}
) {
  const [distancesByShopId, setDistancesByShopId] = useState({})
  const [loading, setLoading] = useState(false)
  const [routingProvider, setRoutingProvider] = useState(null)

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
        setRoutingProvider(null)
        setLoading(false)
      }
      return
    }

    const cacheKey = `${DISTANCE_CACHE_PREFIX}_${roundCoord(originLat)}_${roundCoord(originLng)}_${paidLimit}_${key}`

    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        const fresh = Date.now() - parsed.timestamp < 60 * 60 * 1000
        const versionOk = parsed.cacheVersion === DISTANCE_CACHE_VERSION
        if (fresh && versionOk && Object.keys(parsed.distances || {}).length > 0) {
          setDistancesByShopId(parsed.distances)
          setRoutingProvider(parsed.provider || null)
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.warn('Frontend distance cache read failed', e)
    }

    let cancelled = false
    setLoading(true)
    setRoutingProvider(null)

    const run = async () => {
      const origin = { lat: originLat, lng: originLng }
      const shopDistances = []

      shopsWithCoords.forEach((shop) => {
        const dest = getShopCoords(shop)
        const straightKm = distanceKm(originLat, originLng, dest.lat, dest.lng)
        if (straightKm != null && Number.isFinite(straightKm)) {
          shopDistances.push({ shop, km: straightKm })
        }
      })

      if (cancelled) return

      shopDistances.sort((a, b) => a.km - b.km)
      const exactShops = shopDistances.slice(0, paidLimit).map((s) => s.shop)

      const next = {}

      if (exactShops.length > 0) {
        try {
          const exactDestinations = exactShops.map((shop) => {
            const coords = getShopCoords(shop)
            return { shopId: shop.id, lat: coords.lat, lng: coords.lng }
          })
          const { distancesByShopId: paidByShopId, provider: routeProvider } =
            await fetchDrivingDistancesKm(origin, exactDestinations)

          if (cancelled) return

          exactShops.forEach((shop) => {
            const km = paidByShopId?.[shop.id]
            if (km != null && Number.isFinite(km)) {
              next[shop.id] = km
            }
          })

          if (!cancelled) {
            setRoutingProvider(routeProvider || null)
            if (import.meta.env.DEV && routeProvider) {
              console.info('[PrintGet] Driving distances from:', routeProvider, next)
            }

            if (Object.keys(next).length > 0) {
              try {
                localStorage.setItem(
                  cacheKey,
                  JSON.stringify({
                    timestamp: Date.now(),
                    cacheVersion: DISTANCE_CACHE_VERSION,
                    provider: routeProvider,
                    distances: next,
                  })
                )
              } catch (e) {
                console.warn('Frontend distance cache write failed', e)
              }
            }
          }
        } catch (e) {
          console.warn('Driving distance API failed', e)
        }
      }

      if (!cancelled) {
        setDistancesByShopId(next)
        setLoading(false)
      }
    }

    run().catch((e) => {
      console.error('Hybrid routing error:', e)
      if (!cancelled) {
        setDistancesByShopId({})
        setRoutingProvider(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [originLat, originLng, key, paidLimit, shopsWithCoords, coordsReady])

  return { distancesByShopId, loading, routingProvider }
}
