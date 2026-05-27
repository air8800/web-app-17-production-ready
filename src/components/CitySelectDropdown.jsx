import React, { useEffect, useRef, useState } from 'react'
import { MapPin, Globe, Check, ChevronDown } from 'lucide-react'
import { ALL_CITIES_LABEL } from '../utils/city'

const CitySelectDropdown = ({
  value,
  options,
  onChange,
  placeholder = 'Choose a location...',
  highlightEmpty = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('touchstart', handlePointerDown)
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  const handleSelect = (city) => {
    onChange(city)
    setIsOpen(false)
  }

  return (
    <div ref={rootRef} className="relative group">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`w-full flex items-center justify-between pl-16 pr-6 py-4 text-lg font-medium bg-white rounded-2xl cursor-pointer transition-all duration-200 ${
          highlightEmpty && !value
            ? 'border-2 border-blue-400 attention-shimmer'
            : 'border border-gray-200 shadow-sm'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'hover:border-blue-300'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate ${value ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-blue-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors duration-200">
          <MapPin className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-2 max-h-60 overflow-hidden rounded-2xl border-2 border-blue-500 bg-white shadow-xl animate-faq-open"
          role="listbox"
        >
          <div className="max-h-60 overflow-y-auto p-1.5">
            {options.map((city) => {
              const selected = value === city
              return (
                <button
                  key={city}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(city)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-colors duration-150 ${
                    selected ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {city === ALL_CITIES_LABEL ? (
                    <Globe className={`w-4 h-4 ${selected ? 'text-blue-500' : 'text-gray-400'}`} />
                  ) : (
                    <MapPin className={`w-4 h-4 ${selected ? 'text-blue-500' : 'text-gray-400'}`} />
                  )}
                  <span className="flex-1 truncate">{city}</span>
                  {selected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CitySelectDropdown
