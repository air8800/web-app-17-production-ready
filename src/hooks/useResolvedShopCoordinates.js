import { useEffect, useMemo, useState } from 'react'
import {
  enrichShopWithCoordinates,
  findDuplicateCoordinateGroups,
  geocodeShopAddress,
  getShopCoords,
  shopNeedsAddressGeocode,
} from '../utils/location'

function clearShopGeocodeCache(shopId) {
  try {
    const key = 'printget_shop_geocode_v1'
    const raw = localStorage.getItem(key)
    if (!raw) return
    const cache = JSON.parse(raw)
    delete cache[shopId]
    localStorage.setItem(key, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

/**
 * Geocodes shops that have no coordinates, legacy catch-all coords, or
 * duplicate coordinates shared with another shop at a different address.
 */
export function useResolvedShopCoordinates(shops) {
  const [geocodedByShopId, setGeocodedByShopId] = useState({})
  const [resolving, setResolving] = useState(false)

  const shopsNeedingGeocode = useMemo(
    () => (shops || []).filter((shop) => shopNeedsAddressGeocode(shop, shops)),
    [shops]
  )

  const duplicateGroups = useMemo(() => findDuplicateCoordinateGroups(shops), [shops])

  const geocodeKey = useMemo(
    () =>
      shopsNeedingGeocode
        .map((s) => `${s.id}:${String(s.address || '').trim()}`)
        .sort()
        .join('|'),
    [shopsNeedingGeocode]
  )

  useEffect(() => {
    if (shopsNeedingGeocode.length === 0) {
      setResolving(false)
      return undefined
    }

    let cancelled = false
    setResolving(true)

    if (duplicateGroups.length > 0 && import.meta.env.DEV) {
      console.warn(
        '[PrintGet] Shops sharing identical coordinates with different addresses — re-geocoding from address:',
        duplicateGroups.map((group) => group.map((s) => ({ id: s.id, name: s.name, address: s.address })))
      )
    }

    const run = async () => {
      for (const shop of shopsNeedingGeocode) {
        clearShopGeocodeCache(shop.id)
      }

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
  }, [geocodeKey, shopsNeedingGeocode, duplicateGroups.length])

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

  return { shopsWithCoords, resolving, allHaveCoords, duplicateGroups }
}
