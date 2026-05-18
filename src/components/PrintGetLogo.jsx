import React from 'react'
import { Link } from 'react-router-dom'

const markSizes = {
  sm: 'h-6 w-6 rounded-md',
  md: 'h-7 w-7 rounded-lg',
  lg: 'h-9 w-9 rounded-lg',
}

const textSizes = {
  sm: 'text-base font-bold tracking-tight',
  md: 'text-lg font-bold tracking-tight',
  lg: 'text-xl font-bold tracking-tight',
}

/**
 * Brand logo — SVG mark (same as favicon, no PNG fringe).
 */
const PrintGetLogo = ({
  size = 'md',
  showText = true,
  variant = 'default',
  className = '',
  to,
  onClick,
}) => {
  const printColor = variant === 'light' ? 'text-white' : 'text-gray-900'
  const getGradient =
    variant === 'light'
      ? 'bg-gradient-to-r from-blue-400 to-indigo-400'
      : 'bg-gradient-to-r from-blue-600 to-indigo-600'

  const content = (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <span
        className={`${markSizes[size]} overflow-hidden flex-shrink-0 block`}
        aria-hidden
      >
        <img
          src="/favicon.svg"
          alt=""
          className="h-full w-full object-contain"
          draggable={false}
        />
      </span>
      {showText && (
        <span className={`${textSizes[size]} ${printColor} leading-none`}>
          Print
          <span className={`text-transparent bg-clip-text ${getGradient}`}>Get</span>
        </span>
      )}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="group inline-flex" onClick={onClick}>
        {content}
      </Link>
    )
  }

  return content
}

export default PrintGetLogo
