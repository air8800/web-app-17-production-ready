import { useEffect } from 'react'

/**
 * InstallPrompt — invisible component.
 * - Captures the browser's `beforeinstallprompt` event so InstallButton can use it.
 * - Listens for `appinstalled` and redirects into the PWA on the SAME visit.
 * No UI is rendered.
 */
const InstallPrompt = () => {
    useEffect(() => {
        // Don't run redirect logic if already inside the installed PWA
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true

        if (isStandalone) return

        // Capture the install prompt so InstallButton / InstallBanner can trigger it
        const handleBeforeInstall = (e) => {
            e.preventDefault()
            window.deferredPrompt = e
        }

        // When the app is installed (same visit), redirect into the PWA window
        const handleAppInstalled = () => {
            window.deferredPrompt = null
            // Small delay so the browser has time to register the PWA fully
            setTimeout(() => {
                window.location.href = window.location.href
            }, 1500)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    return null
}

export default InstallPrompt
