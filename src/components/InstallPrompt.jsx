import { useEffect, useState } from 'react'

/**
 * InstallPrompt — no install banner UI.
 * Responsibilities:
 *  1. Captures `beforeinstallprompt` → stores on window.deferredPrompt for InstallButton
 *  2. Listens for `appinstalled` + custom `pwa-install-accepted` event
 *  3. Shows a premium "App Installed!" overlay that pushes users to open the PWA
 */
const InstallPrompt = () => {
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        // Already running inside the installed PWA — nothing to do
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        if (isStandalone) return

        // Capture install prompt for InstallButton to use
        const handleBeforeInstall = (e) => {
            e.preventDefault()
            window.deferredPrompt = e
        }

        // Show success overlay when install is confirmed by the browser
        const handleAppInstalled = () => {
            window.deferredPrompt = null
            setShowSuccess(true)
        }

        // InstallButton dispatches this event after outcome === 'accepted'
        const handleInstallAccepted = () => {
            setShowSuccess(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('appinstalled', handleAppInstalled)
        window.addEventListener('pwa-install-accepted', handleInstallAccepted)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
            window.removeEventListener('appinstalled', handleAppInstalled)
            window.removeEventListener('pwa-install-accepted', handleInstallAccepted)
        }
    }, [])

    const handleOpenApp = () => {
        // On Android Chrome this navigation is intercepted and opens in the PWA window.
        // On desktop it opens a new tab which Chrome/Edge may launch as the app window.
        window.open(window.location.origin, '_blank', 'noopener')
    }

    const handleContinueInBrowser = () => {
        setShowSuccess(false)
    }

    if (!showSuccess) return null

    return (
        <>
            {/* Full-screen backdrop */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    background: 'rgba(10, 20, 50, 0.75)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    animation: 'pgFadeIn 0.35s ease forwards',
                }}
            >
                {/* Card */}
                <div
                    style={{
                        width: '100%',
                        maxWidth: 380,
                        background: '#fff',
                        borderRadius: 28,
                        padding: '36px 28px 28px',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0,
                        animation: 'pgSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
                        textAlign: 'center',
                    }}
                >
                    {/* Success ring + icon */}
                    <div style={{ position: 'relative', marginBottom: 20 }}>
                        {/* Animated ring */}
                        <div style={{
                            position: 'absolute',
                            inset: -6,
                            borderRadius: '50%',
                            border: '3px solid transparent',
                            borderTopColor: '#2563eb',
                            borderRightColor: '#2563eb',
                            animation: 'pgSpin 0.6s ease-out forwards',
                        }} />
                        {/* App icon */}
                        <img
                            src="/icon-192.png"
                            alt="PrintGet"
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 18,
                                display: 'block',
                                boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
                            }}
                        />
                        {/* Green checkmark badge */}
                        <div style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#22c55e',
                            border: '2.5px solid #fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pgPopIn 0.35s 0.4s cubic-bezier(0.16,1,0.3,1) both',
                        }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* Heading */}
                    <p style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#0f172a',
                        margin: '0 0 8px',
                        letterSpacing: '-0.3px',
                        lineHeight: 1.2,
                    }}>
                        App Installed!
                    </p>

                    {/* Subtitle */}
                    <p style={{
                        fontSize: 14.5,
                        color: '#64748b',
                        lineHeight: 1.55,
                        margin: '0 0 28px',
                        maxWidth: 280,
                    }}>
                        PrintGet is on your home screen. Open the app for a faster, full-screen experience.
                    </p>

                    {/* Primary CTA */}
                    <button
                        onClick={handleOpenApp}
                        style={{
                            width: '100%',
                            padding: '15px 20px',
                            borderRadius: 16,
                            border: 'none',
                            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4f46e5 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 16,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            marginBottom: 14,
                            letterSpacing: '-0.1px',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 12px 32px rgba(37,99,235,0.5)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.4)'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Open PrintGet App
                    </button>

                    {/* Secondary — stay in browser */}
                    <button
                        onClick={handleContinueInBrowser}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: 13.5,
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontWeight: 500,
                            transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                    >
                        Continue in browser
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pgFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pgSlideUp {
                    from { opacity: 0; transform: translateY(32px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
                @keyframes pgPopIn {
                    from { opacity: 0; transform: scale(0.4); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes pgSpin {
                    from { transform: rotate(0deg);   opacity: 1; }
                    to   { transform: rotate(360deg); opacity: 0; }
                }
            `}</style>
        </>
    )
}

export default InstallPrompt
