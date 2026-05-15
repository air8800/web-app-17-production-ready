/**
 * Mobile-first detection for PhonePe checkout (client hint + layout).
 * Server still validates via User-Agent as a fallback.
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent || ''
  const uaMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
  const iPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const narrowViewport = window.matchMedia?.('(max-width: 768px)')?.matches ?? false

  return uaMobile || iPad || narrowViewport
}

export function getCheckoutPlatform() {
  return isMobileDevice() ? 'mobile' : 'desktop'
}
