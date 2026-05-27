import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const MIN_EXPAND_CHARS = 36

const ExpandableAddress = ({
  address,
  className = '',
  textClassName = 'text-sm font-medium text-gray-500',
  fadeFromClass = 'from-white',
  onExpandedChange,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef(null)

  const checkOverflow = useCallback(() => {
    const el = textRef.current
    if (!el || expanded) {
      setIsOverflowing(false)
      return
    }
    setIsOverflowing(el.scrollWidth > el.clientWidth + 1)
  }, [expanded])

  useEffect(() => {
    checkOverflow()
  }, [address, checkOverflow])

  useEffect(() => {
    const el = textRef.current
    if (!el) return undefined

    const observer = new ResizeObserver(() => {
      checkOverflow()
    })
    observer.observe(el)
    if (el.parentElement) {
      observer.observe(el.parentElement)
    }

    window.addEventListener('resize', checkOverflow)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', checkOverflow)
    }
  }, [address, checkOverflow])

  useEffect(() => {
    onExpandedChange?.(expanded)
  }, [expanded, onExpandedChange])

  if (!address) return null

  const canExpand = expanded || isOverflowing || address.length > MIN_EXPAND_CHARS
  const hintGradient = fadeFromClass.startsWith('from-')
    ? `bg-gradient-to-b from-transparent ${fadeFromClass.replace('from-', 'to-')}`
    : 'bg-gradient-to-b from-transparent to-white'

  const toggle = (event) => {
    if (!canExpand) return
    event.preventDefault()
    event.stopPropagation()
    setExpanded((value) => !value)
  }

  return (
    <div
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      onClick={toggle}
      onKeyDown={(event) => {
        if (!canExpand) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          setExpanded((value) => !value)
        }
      }}
      className={`group min-w-0 w-full flex-1 rounded-lg transition-all duration-200 ${
        canExpand
          ? 'cursor-pointer hover:bg-gray-50/90 active:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200'
          : ''
      } ${className}`}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <div className="flex w-full min-w-0 items-start gap-0.5">
        <p
          ref={textRef}
          className={`${textClassName} min-w-0 flex-1 leading-snug ${
            expanded ? 'whitespace-pre-wrap break-words' : 'truncate'
          }`}
        >
          {address}
        </p>
        {canExpand && (
          <span className="relative z-10 mt-0.5 flex-shrink-0 rounded-md bg-white pl-0.5 shadow-[-6px_0_10px_rgba(255,255,255,0.95)]">
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                expanded ? 'rotate-180 text-blue-600' : 'group-hover:text-blue-600'
              }`}
            />
          </span>
        )}
      </div>

      {canExpand && !expanded && (
        <div
          className={`pointer-events-none mt-0.5 h-1.5 w-full max-w-[calc(100%-1.5rem)] rounded-b-sm ${hintGradient}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default ExpandableAddress
