import React, { useEffect, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import {
  enrichShopWithCoordinates,
  fetchDrivingDistancesKm,
  getDrivingDistanceLabel,
  getGoogleMapsDirectionsUrl,
  getShopCoords,
} from '../utils/location'
import { useUserLocation } from '../hooks/useUserLocation'

/**
 * Distance + Google Maps directions for a shop (uses live GPS + driving route distance).
 */
const ShopLocationBar = ({ shop, variant = 'card', className = '' }) => {
  const { userLocation } = useUserLocation()
  const [drivingKm, setDrivingKm] = useState(null)
  const [loadingDistance, setLoadingDistance] = useState(false)

  useEffect(() => {
    if (!shop || !userLocation) {
      setDrivingKm(null)
      setLoadingDistance(false)
      return undefined
    }

    const enriched = enrichShopWithCoordinates(shop)
    const coords = getShopCoords(enriched)
    if (!coords) {
      setDrivingKm(null)
      return undefined
    }

    let cancelled = false
    setLoadingDistance(true)

    fetchDrivingDistancesKm(userLocation, [coords])
      .then((distances) => {
        if (cancelled) return
        const km = distances?.[0]
        setDrivingKm(Number.isFinite(km) ? km : null)
      })
      .catch(() => {
        if (!cancelled) setDrivingKm(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingDistance(false)
      })

    return () => {
      cancelled = true
    }
  }, [shop, userLocation?.lat, userLocation?.lng])

  if (!shop) return null

  const shopWithCoords = enrichShopWithCoordinates(shop)
  const distanceLabel = userLocation
    ? getDrivingDistanceLabel(drivingKm, { loading: loadingDistance })
    : null
  const directionsUrl = getGoogleMapsDirectionsUrl(shopWithCoords, userLocation)

  if (!directionsUrl && !distanceLabel) return null

  const directionsLink = directionsUrl ? (
    <a
      href={directionsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      <Navigation className="w-3.5 h-3.5" />
      Get directions
    </a>
  ) : null

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 w-full ${className}`.trim()}>
        {distanceLabel && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {distanceLabel}
          </span>
        )}
        {directionsLink}
        {!userLocation && directionsLink && (
          <span className="text-[11px] text-gray-500">Enable location on home for distance</span>
        )}
      </div>
    )
  }

  return (
    <div className={`mt-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-3 sm:p-4 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
          <MapPin className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Pickup at this shop</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{shop.name}</p>
          {shop.address && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{shop.address}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {distanceLabel && (
              <span className="text-sm font-bold text-blue-600">{distanceLabel}</span>
            )}
            {directionsLink}
          </div>
          {!userLocation && (
            <p className="text-[11px] text-gray-500 mt-2">
              Tip: use &quot;Detect my location&quot; on the home page to see how far this shop is.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShopLocationBar
