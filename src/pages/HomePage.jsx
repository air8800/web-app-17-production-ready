import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAllActiveShops, getJobStatus } from '../utils/supabase'
import {
  getDrivingDistanceKm,
  getDrivingDistanceLabel,
  getGoogleMapsDirectionsUrl,
  LOCATION_COARSE_ACCURACY_M,
  sortShopsByDrivingDistance,
  enrichShopWithCoordinates,
  fetchCityFromCoordinates,
} from '../utils/location'
import { useUserLocation } from '../hooks/useUserLocation'
import { useDrivingDistances } from '../hooks/useDrivingDistances'
import { useResolvedShopCoordinates } from '../hooks/useResolvedShopCoordinates'
import { Printer, Search, Store, Clock, MapPin, Phone, ArrowRight, Zap, Shield, Upload, Settings, FileCheck, Package, Mail, ChevronRight, Navigation, LocateFixed, Loader2 } from 'lucide-react'
import { createRecentOrderPayload, getOrderDisplayNumber } from '../utils/orderDisplay'
import {
  ALL_CITIES_LABEL,
  formatCityName,
  getAvailableCities,
  normalizeCityKey,
  shopMatchesCity,
} from '../utils/city'
import ExpandableAddress from '../components/ExpandableAddress'
import CitySelectDropdown from '../components/CitySelectDropdown'

const CITY_STORAGE_KEY = 'printflow_selected_city'

// Helper: Check if a shop is currently open (desktop session overrides scheduled hours)
const isShopOpen = (shop) => {
  if (shop?.desktop_live === false) return false
  if (shop?.desktop_live === true) return true
  if (!shop?.operating_hours) return null // unknown
  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[now.getDay()]
  const todayHours = shop.operating_hours[today]
  if (!todayHours) return null
  if (todayHours === 'Closed' || (typeof todayHours === 'object' && todayHours.closed)) return false
  let openTime, closeTime
  if (typeof todayHours === 'string' && todayHours.includes('-')) {
    [openTime, closeTime] = todayHours.split('-').map(t => t.trim())
  } else if (typeof todayHours === 'object') {
    openTime = todayHours.open
    closeTime = todayHours.close
  }
  if (!openTime || !closeTime) return null
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const openMins = oh * 60 + (om || 0)
  const closeMins = ch * 60 + (cm || 0)
  return nowMins >= openMins && nowMins < closeMins
}

import { usePageTitle } from '../hooks/usePageTitle'
import InstallButton from '../components/InstallButton'
import PrintGetLogo from '../components/PrintGetLogo'

// Individual shop card with scroll-triggered animation
const ShopCard = ({ shop, index, glow, userLocation, isNearest, needsLocation, drivingKm, distancesLoading }) => {
  const cardRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const shopWithCoords = enrichShopWithCoordinates(shop)
  // Show driving distance from OSRM batch table
  const distanceLabel = userLocation
    ? getDrivingDistanceLabel(drivingKm, { loading: distancesLoading })
    : null
  const directionsUrl = getGoogleMapsDirectionsUrl(shopWithCoords, userLocation)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Link
      ref={cardRef}
      to={`/shop/${shop.id}`}
      className={`block bg-white rounded-2xl border p-6 transition-all duration-300 active:scale-[0.98] relative overflow-hidden ${
        glow ? 'animate-boundary-glow' : 'border-gray-100'
      }`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s`,
      }}
    >
      <div className="flex items-start gap-5 mb-5 relative z-10">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
          <Printer className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-bold text-xl text-gray-900 truncate">{shop.name}</h3>
            {isNearest && distanceLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100">
                Nearest
              </span>
            )}
          </div>
          {distanceLabel ? (
            <p className="text-sm font-semibold text-blue-600 mb-1.5">{distanceLabel}</p>
          ) : needsLocation ? (
            <p className="text-sm text-amber-600 mb-1.5">Allow location to see distance</p>
          ) : null}
          <div className="flex items-start gap-1.5 text-gray-500 mb-2">
            <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400 mt-0.5" />
            <ExpandableAddress address={shop.address} fadeFromClass="from-white" />
          </div>
          <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md">
            <Phone className="w-3.5 h-3.5" />
            <span className="text-sm font-semibold">{shop.phone}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100 relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const open = isShopOpen(shop)
            if (open === true) return (
              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                OPEN
              </span>
            )
            if (open === false) return (
              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-100">
                CLOSED
              </span>
            )
            return (
              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-gray-50 text-gray-500 border border-gray-100">
                HOURS N/A
              </span>
            )
          })()}
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <Navigation className="w-3 h-3" />
              Directions
            </a>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-blue-600">
          <span className="text-xs font-semibold text-gray-400">Order</span>
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    </Link>
  )
}

const HomePage = () => {
  usePageTitle({
    title: 'Online Document Printing Service in Nashik & Pune | Upload & Print at Nearby Shops',
    description: 'PrintGet lets you upload PDFs and documents online and print them at your nearest local print shop in Nashik & Pune, Maharashtra. Fast, easy, and affordable - black & white, color, single & double-sided.',
    path: '/'
  })
  const [shops, setShops] = useState([])
  const { shopsWithCoords: shopsResolved, resolving: coordsResolving } = useResolvedShopCoordinates(shops)
  const [recentShops, setRecentShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState(() => {
    return localStorage.getItem(CITY_STORAGE_KEY) || null
  })
  const howItWorksRef = useRef(null)
  const cityRef = useRef(null)
  const hasManualCitySelectionRef = useRef(false)
  const [cityVisible, setCityVisible] = useState(false)
  const [shouldGlow, setShouldGlow] = useState(false)
  const [visibleShopsCount, setVisibleShopsCount] = useState(5)
  const {
    userLocation,
    status: locationStatus,
    error: locationError,
    requestLocation,
    clearLocation: clearUserLocation,
  } = useUserLocation()

  const [isCitySupported, setIsCitySupported] = useState(true)
  const [detectedCityName, setDetectedCityName] = useState('')
  const [hasPromptedLocation, setHasPromptedLocation] = useState(false)

  const availableCities = useMemo(() => getAvailableCities(shops), [shops])

  const availableCityByKey = useMemo(() => {
    return new Map(availableCities.map((city) => [normalizeCityKey(city), city]))
  }, [availableCities])

  const cityOptions = useMemo(() => [ALL_CITIES_LABEL, ...availableCities], [availableCities])

  // Auto-detect location for completely new users
  useEffect(() => {
    if (!selectedCity && !userLocation && locationStatus === 'idle' && !hasPromptedLocation) {
      setHasPromptedLocation(true)
      requestLocation()
    }
  }, [selectedCity, userLocation, locationStatus, requestLocation, hasPromptedLocation])

  // Reverse geocode when location changes
  useEffect(() => {
    let cancelled = false

    if (userLocation?.lat && userLocation?.lng) {
      fetchCityFromCoordinates(userLocation.lat, userLocation.lng).then(city => {
        if (cancelled) return

        const detectedCity = formatCityName(city)
        if (detectedCity) {
          setDetectedCityName(detectedCity)

          if (!hasManualCitySelectionRef.current) {
            const supportedCity = availableCityByKey.get(normalizeCityKey(detectedCity))
            if (supportedCity) {
              setIsCitySupported(true)
              setSelectedCity(supportedCity)
            } else {
              setIsCitySupported(false)
              setSelectedCity(detectedCity)
            }
          }
        } else {
          setDetectedCityName('')
          if (!hasManualCitySelectionRef.current) {
            // If reverse geocoding fails to find a city name, but we have GPS,
            // safely default to All Cities so the nearest shops still load.
            setIsCitySupported(true)
            setSelectedCity(ALL_CITIES_LABEL)
          }
        }
      })
    } else if (locationStatus === 'error' && !selectedCity) {
      // Fallback if they deny location prompt
      setSelectedCity(ALL_CITIES_LABEL)
    }

    return () => {
      cancelled = true
    }
  }, [userLocation, locationStatus, selectedCity, availableCityByKey])

  useEffect(() => {
    if (!selectedCity || selectedCity === ALL_CITIES_LABEL) {
      setIsCitySupported(true)
      return
    }

    if (availableCityByKey.has(normalizeCityKey(selectedCity))) {
      setIsCitySupported(true)
    } else if (detectedCityName && normalizeCityKey(selectedCity) === normalizeCityKey(detectedCityName)) {
      setIsCitySupported(false)
    } else if (!hasManualCitySelectionRef.current && availableCities.length > 0) {
      setIsCitySupported(false)
    }
  }, [selectedCity, detectedCityName, availableCities.length, availableCityByKey])

  useEffect(() => {
    setVisibleShopsCount(5)
  }, [selectedCity, searchTerm, userLocation])

  const [recentOrder, setRecentOrder] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('printget_recent_order') || 'null')
      if (!stored) return null
      // Show banner only if order is less than 24 hours old
      const ageHours = (Date.now() - stored.timestamp) / (1000 * 60 * 60)
      if (ageHours > 24) {
        localStorage.removeItem('printget_recent_order')
        return null
      }
      return stored
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!recentOrder?.jobId || recentOrder.orderNumber || recentOrder.shopOrderNumber) return undefined

    let cancelled = false

    getJobStatus(recentOrder.jobId).then(({ data }) => {
      if (cancelled || !data) return
      const nextRecentOrder = createRecentOrderPayload(data, {
        shopId: recentOrder.shopId || data.shop_id,
      })
      setRecentOrder(nextRecentOrder)
      localStorage.setItem('printget_recent_order', JSON.stringify(nextRecentOrder))
    })

    return () => {
      cancelled = true
    }
  }, [recentOrder?.jobId, recentOrder?.orderNumber, recentOrder?.shopOrderNumber, recentOrder?.shopId])

  useEffect(() => {
    loadShops()
    loadRecentShops()
  }, [])

  // Observe when city dropdown scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCityVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    if (cityRef.current) observer.observe(cityRef.current)
    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    if (selectedCity) {
      localStorage.setItem(CITY_STORAGE_KEY, selectedCity)
    } else {
      localStorage.removeItem(CITY_STORAGE_KEY)
    }
  }, [selectedCity])

  const loadShops = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await getAllActiveShops()

      if (error) {
        throw new Error(`Failed to load shops: ${error.message}`)
      }

      setShops(data || [])

    } catch (error) {
      console.error('Error loading shops:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentShops = () => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentShops') || '[]')
      setRecentShops(recent)
    } catch (error) {
      console.error('❌ Error loading recent shops:', error)
    }
  }

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToCitySelection = () => {
    document.getElementById('city-selection')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setShouldGlow(true)
    setTimeout(() => setShouldGlow(false), 1500)
  }

  const filteredShops = useMemo(() => {
    return shopsResolved.filter(shop => {
      // If the city is unsupported (e.g. Mumbai), don't filter out shops, show all so they can route to nearest
      if (isCitySupported && selectedCity && selectedCity !== ALL_CITIES_LABEL && !shopMatchesCity(shop, selectedCity)) {
        return false
      }
      if (searchTerm && !shop.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !shop.address.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      return true
    })
  }, [shopsResolved, selectedCity, searchTerm, isCitySupported])

  const recentShopsMerged = useMemo(() => {
    return recentShops.map((recent) => {
      const full = shopsResolved.find((s) => s.id === recent.id)
      return full ? { ...recent, ...full } : recent
    })
  }, [recentShops, shopsResolved])

  const shopsForDistance = useMemo(() => {
    const byId = new Map()
    for (const shop of [...filteredShops, ...recentShopsMerged]) {
      byId.set(shop.id, shop)
    }
    return [...byId.values()]
  }, [filteredShops, recentShopsMerged])

  const exactDistanceLimit = Math.max(50, visibleShopsCount)
  const { distancesByShopId, loading: distancesLoading } = useDrivingDistances(
    userLocation,
    shopsForDistance,
    exactDistanceLimit,
    { coordsReady: !coordsResolving }
  )

  const sortedFilteredShops = useMemo(
    () =>
      userLocation
        ? sortShopsByDrivingDistance(filteredShops, distancesByShopId)
        : filteredShops,
    [filteredShops, userLocation, distancesByShopId]
  )

  const nearestShopId = useMemo(() => {
    if (!userLocation || sortedFilteredShops.length === 0) return null
    const first = sortedFilteredShops.find(
      (shop) => getDrivingDistanceKm(distancesByShopId, shop.id) != null
    )
    return first?.id ?? null
  }, [sortedFilteredShops, userLocation, distancesByShopId])

  const locationAccuracy = Number.isFinite(userLocation?.accuracy)
    ? Math.round(userLocation.accuracy)
    : null
  const hasCoarseLocation = locationAccuracy != null && locationAccuracy > LOCATION_COARSE_ACCURACY_M

  const recentShopsEnriched = useMemo(
    () =>
      userLocation
        ? sortShopsByDrivingDistance(recentShopsMerged, distancesByShopId)
        : recentShopsMerged,
    [recentShopsMerged, userLocation, distancesByShopId]
  )

  const handleCitySelect = useCallback(
    (city) => {
      const value = city === ALL_CITIES_LABEL ? ALL_CITIES_LABEL : city
      hasManualCitySelectionRef.current = true
      setSelectedCity(value)
      setIsCitySupported(value === ALL_CITIES_LABEL || availableCityByKey.has(normalizeCityKey(value)))
      setSearchTerm('')
      if (value && value !== ALL_CITIES_LABEL && !userLocation) {
        requestLocation()
      }
    },
    [requestLocation, userLocation, availableCityByKey]
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-white/50 via-blue-50/40 to-white/50 backdrop-blur-xl px-4 py-3 sm:py-4 overflow-hidden">
        {/* Decorative Background Accent */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 -right-4 w-24 h-24 bg-gradient-to-bl from-blue-600/15 via-blue-400/5 to-transparent rounded-bl-[80px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
          <PrintGetLogo to="/" size="md" />
          <div className="flex items-center gap-2 sm:gap-3">
            <InstallButton />
            <Link 
              to="/history" 
              className="flex items-center gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 bg-white/80 border border-blue-100 rounded-2xl text-sm font-bold text-gray-800 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-sm shadow-blue-100/20 group"
            >
              <Clock className="w-4 h-4 text-blue-500 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline">My Orders</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-32">
          <div className="text-center animate-fadeInUp">
            {/* Badge */}


            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
              Print Anywhere,
              <span className="gradient-text block">Anytime</span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4">
              Connect with local print shops. Upload and collect your documents instantly.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4 mt-8">
              <button
                onClick={() => document.getElementById('city-selection')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-primary text-sm sm:text-base px-6 py-3 sm:px-8 sm:py-4 w-full sm:w-auto inline-flex items-center justify-center cursor-pointer"
              >
                Find Print Shops
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </button>
              <button onClick={scrollToHowItWorks} className="btn-secondary text-sm sm:text-base px-6 py-3 sm:px-8 sm:py-4 w-full sm:w-auto">
                How it Works
              </button>
            </div>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/10 rounded-full animate-float" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-purple-500/10 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-indigo-500/10 rounded-full animate-float" style={{ animationDelay: '4s' }} />
      </div>


      {/* Recent Order Banner */}
      {recentOrder && (
        <div className="max-w-7xl mx-auto px-4 pt-4 sm:pt-6">
          <div className="bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm shadow-blue-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm">You have a recent order</p>
                <p className="text-gray-500 text-xs truncate">Order ID: <span className="font-mono font-semibold text-blue-600">{getOrderDisplayNumber(recentOrder)}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to={`/status/${recentOrder.jobId}`}
                className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Track Order →
              </Link>
              <button
                onClick={() => {
                  setRecentOrder(null)
                  localStorage.removeItem('printget_recent_order')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-16">

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20 animate-fadeInUp">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-pulse-glow">
              <Printer className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Loading Print Shops</h3>
            <p className="text-gray-600">Connecting to our network of trusted partners...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="text-center py-20 animate-fadeInUp">
            <div className="w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <Store className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Shops</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">{error}</p>
            <button
              onClick={loadShops}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Recent Shops */}
        {!loading && !error && recentShops.length > 0 && (
          <div className="mb-10 sm:mb-16 animate-fadeInUp">
            <div className="flex items-center gap-3 mb-8">
              <div className="feature-icon">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Recently Visited</h2>
                <p className="text-sm sm:text-base text-gray-600">Your recent visits</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentShopsEnriched.map((shop, index) => {
                const drivingKm = getDrivingDistanceKm(distancesByShopId, shop.id)
                const distanceLabel = userLocation
                  ? getDrivingDistanceLabel(drivingKm, { loading: distancesLoading })
                  : null
                const directionsUrl = getGoogleMapsDirectionsUrl(shop, userLocation)
                return (
                <Link
                  key={shop.id}
                  to={`/shop/${shop.id}`}
                  className="print-card card-hover animate-slideInRight"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Printer className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{shop.name}</h3>
                      {distanceLabel && (
                        <p className="text-sm font-semibold text-blue-600 mb-1">{distanceLabel}</p>
                      )}
                      <div className="flex items-start gap-1 text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <ExpandableAddress
                          address={shop.address}
                          textClassName="text-sm text-gray-600"
                          fadeFromClass="from-white"
                        />
                      </div>
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        {(() => {
                          const open = isShopOpen(shop)
                          if (open === true) return <span className="text-green-600 font-medium">Open</span>
                          if (open === false) return <span className="text-red-500 font-medium">Closed</span>
                          return <span className="text-gray-400 font-medium">Hours N/A</span>
                        })()}
                        {directionsUrl && (
                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Directions
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )})}
            </div>
          </div>
        )}

        {/* All Shops */}
        {/* City Selection & Shop Finder */}

        {/* City Selection & Shop Finder */}
        {!loading && !error && (
          <div className="animate-fadeInUp py-8 sm:py-12" id="city-selection">
            <div className="max-w-5xl mx-auto px-4">
              <div className="text-center mb-16 relative z-10">

                <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
                  Find Print Shops <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Near You</span>
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed font-medium">
                  Connect with trusted local printing partners for high-quality results.
                </p>
              </div>

              {/* Selection Card */}
              <div ref={cityRef} className={`bg-white rounded-3xl shadow-xl shadow-blue-900/5 border p-6 md:p-10 mb-10 sm:mb-12 relative transition-all duration-300 ${shouldGlow ? 'animate-boundary-glow' : 'border-blue-100'}`}>
                {/* Subtle Decorative Gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full opacity-50 pointer-events-none" />

                <div className="max-w-2xl mx-auto relative">
                  <div className="space-y-6">
                    {/* City Selection Logic */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Select Your City</label>
                      <CitySelectDropdown
                        value={selectedCity}
                        options={cityOptions}
                        onChange={handleCitySelect}
                        highlightEmpty={cityVisible}
                      />
                    </div>

                    {!isCitySupported && detectedCityName && (
                      <div className="pt-4 border-t border-gray-100 animate-fadeIn">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                          <h3 className="text-lg font-bold text-amber-900 mb-2">
                            Coming soon to {detectedCityName}!
                          </h3>
                          <p className="text-sm text-amber-800">
                            We are expanding fast and will be in your city soon. In the meantime, here are our nearest printing partners from neighboring cities.
                          </p>
                          <button
                            onClick={() => requestLocation()}
                            className="mt-3 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
                          >
                            Update My Location
                          </button>
                        </div>
                      </div>
                    )}
                    {isCitySupported && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-500 ml-1">
                          {userLocation ? 'Showing nearest shops based on your location.' : 'Select a city or detect location to find nearest shops.'}
                        </p>
                        <button
                          onClick={() => requestLocation()}
                          disabled={locationStatus === 'loading'}
                          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          {locationStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
                          {userLocation ? 'Update Location' : 'Detect Location'}
                        </button>
                      </div>
                    )}

                    {locationError && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 leading-relaxed animate-fadeIn">
                        {locationError}
                      </div>
                    )}

                    {selectedCity && (
                      <div className="animate-fadeIn pt-6 border-t border-gray-100">
                        <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Search in {selectedCity}</label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                          </div>
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by shop name, area, or service..."
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-base placeholder-gray-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Filtered Shops Grid */}
            {selectedCity ? (
              sortedFilteredShops.length > 0 ? (
                <>
                  {/* Section label */}
                  <div className="mb-6 px-1">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1">
                      {userLocation ? (
                        <>
                          Nearest Print Shops{' '}
                          <span className="text-blue-600">First</span>
                        </>
                      ) : (
                        <>
                          Available Print Shops{' '}
                          <span className="text-blue-600">Near You</span>
                        </>
                      )}
                      <ChevronRight className="w-5 h-5 text-blue-500 animate-arrow-point" />
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {userLocation
                        ? 'Closest shop at the top · driving distance via road routes'
                        : 'Allow location above to sort nearest shop first'}
                    </p>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {sortedFilteredShops.slice(0, visibleShopsCount).map((shop, index) => (
                    <ShopCard
                      key={shop.id}
                      shop={shop}
                      index={index}
                      glow={shouldGlow}
                      userLocation={userLocation}
                      isNearest={shop.id === nearestShopId}
                      needsLocation={!userLocation && locationStatus !== 'loading'}
                      drivingKm={getDrivingDistanceKm(distancesByShopId, shop.id)}
                      distancesLoading={distancesLoading}
                    />
                  ))}
                </div>
                {sortedFilteredShops.length > visibleShopsCount && (
                  <div className="mt-8 text-center relative z-10">
                    <button 
                      onClick={() => setVisibleShopsCount(prev => prev + 6)}
                      className="px-8 py-3 bg-white border-2 border-blue-100 text-blue-600 font-bold rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-95"
                    >
                      Show More Shops
                    </button>
                  </div>
                )}
                </>

              ) : (
                <div className="max-w-md mx-auto text-center py-20 px-8 bg-white/50 rounded-3xl border border-gray-100 backdrop-blur-sm animate-fadeIn">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner">
                    <Store className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {searchTerm ? 'No Results Found' : `No Shops in ${selectedCity}`}
                  </h3>
                  <p className="text-gray-500 text-lg mb-8">
                    {searchTerm
                      ? <span>We couldn't find any results for <span className="font-semibold text-gray-800">"{searchTerm}"</span> in {selectedCity}.</span>
                      : `We currently don't have any print shops listed in ${selectedCity}.`
                    }
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="px-6 py-2.5 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 font-medium rounded-xl shadow-sm hover:shadow transition-all"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="max-w-lg mx-auto text-center py-24 px-8 bg-blue-50/40 rounded-3xl border border-blue-100 border-dashed animate-pulse-slow">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-white rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-900/5">
                  <MapPin className="w-10 h-10 text-blue-500 animate-bounce" />
                </div>
                <h3 className="text-2xl font-bold text-blue-900 mb-3 tracking-tight">Select a City to Begin</h3>
                <p className="text-blue-700/60 text-lg max-w-sm mx-auto">
                  Choose your location above to discover the best local print shops in your area.
                </p>
              </div>
            )}
          </div>
        )}

        {/* How to Use Section */}
        <div ref={howItWorksRef} className="py-12 sm:py-20 animate-fadeInUp" id="how-it-works">
          <div className="text-center mb-12 sm:mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">How It Works</h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
              Get your documents printed in just a few simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-8 mb-12 sm:mb-16">
            <button
              onClick={scrollToCitySelection}
              className="text-center print-card card-hover block w-full group"
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-4 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform relative">
                  <Store className="w-7 h-7 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-700 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm">1</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Choose Shop</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-[240px] mx-auto">Browse and select from our network of trusted print shops near you</p>
              </div>
            </button>

            <button
              onClick={scrollToCitySelection}
              className="text-center print-card card-hover block w-full group"
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-4 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform relative">
                  <Upload className="w-7 h-7 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-700 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm">2</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Files</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-[240px] mx-auto">Upload your PDF or image files. Multiple files and formats supported</p>
              </div>
            </button>

            <button
              onClick={scrollToCitySelection}
              className="text-center print-card card-hover block w-full group"
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl mb-4 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform relative">
                  <Settings className="w-7 h-7 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-700 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm">3</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Configure</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-[240px] mx-auto">Choose page size, color mode, copies, and other print options</p>
              </div>
            </button>

            <button
              onClick={scrollToCitySelection}
              className="text-center print-card card-hover block w-full group"
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-4 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform relative">
                  <FileCheck className="w-7 h-7 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-700 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm">4</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Submit Order</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-[240px] mx-auto">Review your order details and submit with your contact information</p>
              </div>
            </button>

            <button
              onClick={scrollToCitySelection}
              className="text-center print-card card-hover block w-full group"
            >
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mb-4 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform relative">
                  <Package className="w-7 h-7 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-700 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm">5</div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Collect Prints</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-[240px] mx-auto">Visit the shop and collect your professionally printed documents</p>
              </div>
            </button>
          </div>

          <div id="powerful-features" className="glass-card bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-8 sm:p-12 rounded-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">Powerful Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Printer className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">PDF & Image Support</h4>
                  <p className="text-gray-600 text-sm">Upload PDFs, JPG, PNG files with built-in editor for adjustments</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Flexible Page Sizes</h4>
                  <p className="text-gray-600 text-sm">A3, A4, A5, Letter, Legal and more international paper sizes</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Color & Black/White</h4>
                  <p className="text-gray-600 text-sm">Choose between color or B&W printing with instant preview</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Advanced Options</h4>
                  <p className="text-gray-600 text-sm">Page selection, N-up printing, single/double-sided options</p>
                </div>
              </div>
            </div>
          </div>
        </div>



      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-4 sm:mt-20">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="col-span-2 lg:col-span-1">
              <div className="mb-4">
                <PrintGetLogo size="md" variant="light" />
              </div>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                Your trusted platform for convenient printing services. Connect with local print shops and get your documents printed quickly.
              </p>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-0.5">Registered Office</span>
                    Ambajogai, Beed,<br className="hidden sm:inline" /> Maharashtra, India
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                  <a href="mailto:support@printget.in" className="hover:text-blue-400 transition-colors break-all">support@printget.in</a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                  <a href="tel:+918329232242" className="hover:text-blue-400 transition-colors">+91 83292 32242</a>
                </li>
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button onClick={scrollToCitySelection} className="hover:text-blue-400 transition-colors text-left">Find Shops</button>
                </li>
                <li>
                  <button onClick={scrollToHowItWorks} className="hover:text-blue-400 transition-colors text-left">How It Works</button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('powerful-features')?.scrollIntoView({ behavior: 'smooth' })} 
                    className="hover:text-blue-400 transition-colors text-left"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <Link to="/history" className="hover:text-blue-400 transition-colors">My Orders</Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/about" className="hover:text-blue-400 transition-colors">About Us</Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-blue-400 transition-colors">FAQ / Help</Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-blue-400 transition-colors">Contact Us</Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="col-span-2 lg:col-span-1">
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/refund-policy" className="hover:text-blue-400 transition-colors">Refund & Cancellation</Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className="hover:text-blue-400 transition-colors">Cookie Policy</Link>
                </li>
              </ul>
            </div>



          </div>



          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} PrintGet. All rights reserved.
              </p>
              <div className="flex gap-6 text-sm">
                <Link to="/terms" className="hover:text-blue-400 transition-colors">Terms</Link>
                <Link to="/privacy" className="hover:text-blue-400 transition-colors">Privacy</Link>
                <Link to="/cookie-policy" className="hover:text-blue-400 transition-colors">Cookies</Link>
                <Link to="/contact" className="hover:text-blue-400 transition-colors">Contact</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div >
  )
}

export default HomePage
