import { useEffect, useMemo, useState } from 'react'
import { enrichShopWithCoordinates, fetchDrivingDistancesKm, getShopCoords } from '../utils/location'

function shopsKey(shops) {
  return shops
    .map((s) => s.id)
    .sort()
    .join(',')
}

/**
 * Fetches road driving distances from user to each shop (matches Google Maps driving mode).
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

    let cancelled = false
    setLoading(true)

    const run = async () => {
      const next = {}
      const chunkSize = 25

      for (let i = 0; i < shopsWithCoords.length; i += chunkSize) {
        const chunk = shopsWithCoords.slice(i, i + chunkSize)
        const destinations = chunk.map((shop) => getShopCoords(shop))
        const distancesKm = await fetchDrivingDistancesKm(
          { lat: originLat, lng: originLng },
          destinations
        )

        if (cancelled) return

        chunk.forEach((shop, idx) => {
          const km = distancesKm?.[idx]
          if (km != null && Number.isFinite(km)) {
            next[shop.id] = km
          }
        })
      }

      if (!cancelled) {
        setDistancesByShopId(next)
        setLoading(false)
      }
    }

    run().catch(() => {
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
