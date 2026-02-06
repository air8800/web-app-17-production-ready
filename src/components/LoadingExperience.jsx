import React, { useState, useEffect } from 'react'
import { FileText, Loader2, Sparkles } from 'lucide-react'

const LOADING_MESSAGES = [
  "Loading your document...",
  "Preparing pages for editing...",
  "Almost ready...",
  "Setting up workspace..."
]

const LARGE_PDF_MESSAGES = [
  "Reading large document...",
  "Optimizing for performance...",
  "This might take a moment...",
  "Processing high-resolution pages..."
]

const LoadingExperience = ({ loadingStage, loadedCount, totalPages, isLargePdf }) => {
  const [messageIndex, setMessageIndex] = useState(0)
  const [showLargePdfMessage, setShowLargePdfMessage] = useState(false)
  const showLoader = loadingStage === 'parsing' || loadingStage === 'loading'

  const progress = totalPages > 0 ? (loadedCount / totalPages) * 100 : 0

  // Switch to large PDF messages after 3 seconds if isLargePdf is true, or if it takes too long
  useEffect(() => {
    if (isLargePdf) {
      setShowLargePdfMessage(true)
    } else {
      const timer = setTimeout(() => {
        // If still loading after 4 seconds, show generic "large file" hints
        setShowLargePdfMessage(true)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isLargePdf])

  useEffect(() => {
    if (!showLoader) return

    const messages = showLargePdfMessage ? LARGE_PDF_MESSAGES : LOADING_MESSAGES
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 2500)

    return () => clearInterval(interval)
  }, [showLoader, showLargePdfMessage])

  if (!showLoader) return null

  const currentMessage = showLargePdfMessage
    ? LARGE_PDF_MESSAGES[messageIndex % LARGE_PDF_MESSAGES.length]
    : LOADING_MESSAGES[messageIndex % LOADING_MESSAGES.length]

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
      {/* Animated Icon Container */}
      <div className="relative mb-6">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-xl animate-pulse"></div>

        <div className="relative w-24 h-24 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 overflow-hidden">
          {/* Document Icon with float animation */}
          <div className="animate-bounce" style={{ animationDuration: '3s' }}>
            <FileText className="w-10 h-10 text-blue-500" />
          </div>

          {/* Overlay Spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-20 h-20 text-blue-600 animate-spin-slow" viewBox="0 0 100 100">
              <circle
                className="opacity-20"
                cx="50" cy="50" r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <circle
                className="opacity-100"
                cx="50" cy="50" r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray="283"
                strokeDashoffset="200"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Sparkles for "magic" feel */}
          <div className="absolute top-2 right-2">
            <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div className="max-w-xs mx-auto space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-h-[28px] transition-all duration-300">
          {currentMessage}
        </h3>

        {/* Secondary Info */}
        {showLargePdfMessage && (
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            {isLargePdf ? "Large PDF detected" : "Processing..."}
          </p>
        )}

        {/* Progress Bar */}
        {loadingStage === 'loading' && totalPages > 0 && (
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mt-4">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {loadingStage === 'loading' && totalPages > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            {loadedCount} / {totalPages} pages ready
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default LoadingExperience
