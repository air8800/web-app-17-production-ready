import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const COLLAPSE_CHAR_THRESHOLD = 64

const ExpandableAddress = ({
  address,
  className = '',
  textClassName = 'text-sm font-medium text-gray-500',
  fadeFromClass = 'from-white',
}) => {
  const [expanded, setExpanded] = useState(false)

  if (!address) return null

  const canExpand = address.length > COLLAPSE_CHAR_THRESHOLD
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
      className={`group min-w-0 flex-1 rounded-lg transition-all duration-200 ${
        canExpand
          ? 'cursor-pointer hover:bg-gray-50/90 active:bg-gray-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200'
          : ''
      } ${className}`}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <div className="flex items-start gap-1 pr-1">
        <p
          className={`${textClassName} min-w-0 flex-1 leading-snug ${
            expanded ? 'whitespace-pre-wrap break-words' : 'truncate'
          }`}
        >
          {address}
        </p>
        {canExpand && (
          <ChevronDown
            className={`mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
              expanded ? 'rotate-180 text-blue-500' : 'group-hover:text-blue-500'
            }`}
          />
        )}
      </div>

      {canExpand && !expanded && (
        <div
          className={`pointer-events-none mt-0.5 h-2 w-[calc(100%-1.25rem)] rounded-b-sm ${hintGradient}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default ExpandableAddress
