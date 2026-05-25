import { useEffect, useMemo, useState } from 'react'
import { enrichShopWithCoordinates, fetchDrivingDistancesKm, getShopCoords, osrmDrivingDistancesKm, distanceKm } from '../utils/location'

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
 * Hybrid Routing Strategy + Frontend Cache:
 * 1. Checks localStorage for a fresh (1 hour) route cache for the user's neighborhood.
 * 2. Fetches OSRM distances for all shops.
 * 3. Takes the top 3 closest shops.
 * 4. Uses Google Maps only for the top 3.
 * 5. Saves final combined distances to localStorage.
 */
export function useDrivingDistances(userLocation, shops) {
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

  useEffect(() => {
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || shopsWithCoords.length === 0) {
      setDistancesByShopId({})
      setLoading(false)
      return
    }

    // 1. Check frontend localStorage Cache
    const cacheKey = `printget_distances_${roundCoord(originLat)}_${roundCoord(originLng)}_${key}`
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
      const chunkSize = 25
      const origin = { lat: originLat, lng: originLng }
      const shopDistances = []

      // 2. Fetch OSRM distances for all shops in chunks
      for (let i = 0; i < shopsWithCoords.length; i += chunkSize) {
        const chunk = shopsWithCoords.slice(i, i + chunkSize)
        const destinations = chunk.map((shop) => getShopCoords(shop))
        
        try {
          const distancesKm = await osrmDrivingDistancesKm(origin, destinations)
          if (cancelled) return

          chunk.forEach((shop, idx) => {
            const km = distancesKm?.[idx]
            if (km != null && Number.isFinite(km)) {
              next[shop.id] = km
              shopDistances.push({ shop, km })
            }
          })
        } catch (e) {
          console.warn('OSRM fallback fetch failed for chunk', e)
        }
      }

      if (cancelled) return

      // 3. Fallback: If OSRM completely failed or returned nothing, use straight-line distance locally
      if (shopDistances.length === 0 && shopsWithCoords.length > 0) {
        shopsWithCoords.forEach((shop) => {
          const dest = getShopCoords(shop)
          const straightKm = distanceKm(originLat, originLng, dest.lat, dest.lng)
          if (straightKm != null && Number.isFinite(straightKm)) {
            // We temporarily store the straight-line distance so it sorts correctly
            next[shop.id] = straightKm 
            shopDistances.push({ shop, km: straightKm })
          }
        })
      }

      // Sort by whatever distance we found (OSRM or straight-line) and get the Top 3 closest
      shopDistances.sort((a, b) => a.km - b.km)
      const top3Shops = shopDistances.slice(0, 3).map(s => s.shop)

      // 4. Fetch Google Maps exact distance ONLY for those Top 3
      if (top3Shops.length > 0) {
        try {
          const top3Destinations = top3Shops.map((shop) => getShopCoords(shop))
          const googleDistancesKm = await fetchDrivingDistancesKm(origin, top3Destinations)
          
          if (cancelled) return

          top3Shops.forEach((shop, idx) => {
            const km = googleDistancesKm?.[idx]
            // Overwrite the OSRM distance with the exact Google Maps distance
            if (km != null && Number.isFinite(km)) {
              next[shop.id] = km
            }
          })
        } catch (e) {
          console.warn('Google Maps top 3 fetch failed, falling back entirely to OSRM', e)
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
  }, [originLat, originLng, key, shopsWithCoords])

  return { distancesByShopId, loading }
}
