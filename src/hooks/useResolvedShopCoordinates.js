import { useEffect, useMemo, useState } from 'react'
import {
  enrichShopWithCoordinates,
  geocodeShopAddress,
  getShopCoords,
  shopNeedsAddressGeocode,
} from '../utils/location'

/**
 * Geocodes shops that have no coordinates or were given the legacy Nashik catch-all point.
 */
export function useResolvedShopCoordinates(shops) {
  const [geocodedByShopId, setGeocodedByShopId] = useState({})
  const [resolving, setResolving] = useState(false)

  const shopsNeedingGeocode = useMemo(
    () => (shops || []).filter(shopNeedsAddressGeocode),
    [shops]
  )

  const geocodeKey = useMemo(
    () =>
      shopsNeedingGeocode
        .map((s) => s.id)
        .sort()
        .join(','),
    [shopsNeedingGeocode]
  )

  useEffect(() => {
    if (shopsNeedingGeocode.length === 0) {
      setResolving(false)
      return undefined
    }

    let cancelled = false
    setResolving(true)

    const run = async () => {
      const results = await Promise.all(
        shopsNeedingGeocode.map(async (shop) => {
          const coords = await geocodeShopAddress(shop)
          return [shop.id, coords]
        })
      )

      if (cancelled) return

      const next = {}
      for (const [id, coords] of results) {
        if (coords) next[id] = coords
      }
      setGeocodedByShopId((prev) => ({ ...prev, ...next }))
      setResolving(false)
    }

    run().catch(() => {
      if (!cancelled) setResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [geocodeKey, shopsNeedingGeocode])

  const shopsWithCoords = useMemo(
    () =>
      (shops || []).map((shop) => {
        const geocoded = geocodedByShopId[shop.id]
        return enrichShopWithCoordinates(shop, geocoded)
      }),
    [shops, geocodedByShopId]
  )

  const allHaveCoords = useMemo(
    () => shopsWithCoords.length > 0 && shopsWithCoords.every((s) => getShopCoords(s)),
    [shopsWithCoords]
  )

  return { shopsWithCoords, resolving, allHaveCoords }
}
