import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getAllActiveShops } from '../utils/supabase'
import { Printer, Search, Store, Clock, Star, MapPin, Phone, ArrowRight, Zap, Shield, Award, Globe, Upload, Settings, FileCheck, Package, Mail, Facebook, Twitter, Instagram, Linkedin, Sparkles, ChevronDown, Check } from 'lucide-react'

import { usePageTitle } from '../hooks/usePageTitle'

const HomePage = () => {
  usePageTitle() // Sets title to "PrintGet"
  const [shops, setShops] = useState([])
  const [recentShops, setRecentShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState(() => {
    return localStorage.getItem('printflow_selected_city') || null
  })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const howItWorksRef = useRef(null)

  useEffect(() => {
    loadShops()
    loadRecentShops()
  }, [])

  useEffect(() => {
    if (selectedCity) {
      localStorage.setItem('printflow_selected_city', selectedCity)
    } else {
      localStorage.removeItem('printflow_selected_city')
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

  const filteredShops = shops.filter(shop => {
    // 1. City Filter (Primary)
    if (selectedCity && selectedCity !== 'All Cities' && !shop.address.toLowerCase().includes(selectedCity.toLowerCase())) {
      return false
    }

    // 2. Search Filter (Secondary)
    if (searchTerm && !shop.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !shop.address.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    return true
  })

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Get your documents printed in under 15 minutes"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your files are encrypted and auto-deleted after printing"
    },
    {
      icon: Globe,
      title: "Wide Network",
      description: "Access hundreds of print shops across the city"
    },
    {
      icon: Award,
      title: "Quality Guaranteed",
      description: "Professional printing with satisfaction guarantee"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-32">
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


      <div className="max-w-7xl mx-auto px-4 py-16">

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
          <div className="mb-16 animate-fadeInUp">
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
              {recentShops.map((shop, index) => (
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
                      <div className="flex items-center gap-1 text-gray-600 mb-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm truncate">{shop.address}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="text-gray-700">4.8</span>
                        </div>
                        <span className="text-green-600 font-medium">Open</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Shops */}
        {/* City Selection & Shop Finder */}

        {/* City Selection & Shop Finder */}
        {!loading && !error && (
          <div className="animate-fadeInUp py-12" id="city-selection">
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
              <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-blue-100 p-6 md:p-10 mb-12 relative">
                {/* Subtle Decorative Gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-bl-full opacity-50 pointer-events-none" />

                <div className="max-w-2xl mx-auto relative">
                  <div className="space-y-6">
                    {/* City Selection Logic */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Select Your City</label>
                      <div className="relative group">
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full flex items-center justify-between pl-16 pr-6 py-4 text-lg font-medium bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer text-gray-900 hover:border-blue-300"
                        >
                          <span className={selectedCity ? 'text-gray-900' : 'text-gray-400'}>
                            {selectedCity || "Choose a location..."}
                          </span>
                          <ChevronDown className={`w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <MapPin className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>

                        {/* Custom Dropdown Menu */}
                        {isDropdownOpen && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fadeIn">
                            <div className="p-1.5">
                              {['All Cities', 'Nashik', 'Pune'].map((city) => (
                                <button
                                  key={city}
                                  onClick={() => {
                                    setSelectedCity(city === 'All Cities' ? 'All Cities' : city);
                                    setSearchTerm('');
                                    setIsDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left font-medium ${selectedCity === city
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                >
                                  {city === 'All Cities' ? (
                                    <Globe className={`w-4 h-4 ${selectedCity === city ? 'text-blue-500' : 'text-gray-400'}`} />
                                  ) : (
                                    <MapPin className={`w-4 h-4 ${selectedCity === city ? 'text-blue-500' : 'text-gray-400'}`} />
                                  )}
                                  {city}
                                  {selectedCity === city && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Search Bar - Animated Appearance */}
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
              filteredShops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredShops.map((shop, index) => (
                    <Link
                      key={shop.id}
                      to={`/shop/${shop.id}`}
                      className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-200 transition-all duration-300 animate-fadeIn relative overflow-hidden"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-start gap-5 mb-5 relative z-10">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-blue-100 group-hover:to-indigo-100 transition-colors border border-blue-100/50">
                          <Printer className="w-7 h-7 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-xl text-gray-900 mb-1.5 truncate group-hover:text-blue-600 transition-colors">{shop.name}</h3>
                          <div className="flex items-center gap-1.5 text-gray-500 mb-2">
                            <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                            <span className="text-sm font-medium truncate">{shop.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50/50 w-fit px-2 py-0.5 rounded-md">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="text-sm font-semibold">{shop.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-gray-50 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100/50">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-sm font-bold text-amber-700">4.8</span>
                          </div>
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                            OPEN
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Hover Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </Link>
                  ))}
                </div>

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
        <div ref={howItWorksRef} className="py-20 animate-fadeInUp" id="how-it-works">
          <div className="text-center mb-12 sm:mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">How It Works</h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
              Get your documents printed in just a few simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 mb-16">
            <div className="text-center print-card card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Store className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-sm">1</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Choose Shop</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Browse and select from our network of trusted print shops near you</p>
            </div>

            <div className="text-center print-card card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-8 bg-green-600 text-white rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-sm">2</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Upload Files</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Upload your PDF or image files. Multiple files and formats supported</p>
            </div>

            <div className="text-center print-card card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-8 bg-purple-600 text-white rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-sm">3</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Configure</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Choose page size, color mode, copies, and other print options</p>
            </div>

            <div className="text-center print-card card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <FileCheck className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-8 bg-orange-600 text-white rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-sm">4</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Submit Order</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Review your order details and submit with your contact information</p>
            </div>

            <div className="text-center print-card card-hover">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-8 bg-red-600 text-white rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-sm">5</div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Collect Prints</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Visit the shop and collect your professionally printed documents</p>
            </div>
          </div>

          <div className="glass-card bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-8 sm:p-12 rounded-2xl">
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

        {/* Features Section */}
        <div className="py-20 animate-fadeInUp">
          <div className="text-center mb-12 sm:mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">Why Choose Us?</h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 max-w-3xl mx-auto">
              Innovative platform designed for modern needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="text-center print-card card-hover animate-slideInRight"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="feature-icon mx-auto mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Printer className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg">PrintFlow Pro</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Your trusted platform for convenient printing services. Connect with local print shops and get your documents printed quickly.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 bg-gray-800 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#all-shops" className="hover:text-blue-400 transition-colors">Find Shops</a>
                </li>
                <li>
                  <button onClick={scrollToHowItWorks} className="hover:text-blue-400 transition-colors">How It Works</button>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">Features</a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">Pricing</a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">About Us</a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="hover:text-blue-400 transition-colors">Cookie Policy</a>
                </li>
              </ul>
            </div>



          </div>



          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} PrintFlow Pro. All rights reserved.
              </p>
              <div className="flex gap-6 text-sm">
                <a href="#" className="hover:text-blue-400 transition-colors">Terms</a>
                <a href="#" className="hover:text-blue-400 transition-colors">Privacy</a>
                <a href="#" className="hover:text-blue-400 transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div >
  )
}

export default HomePage