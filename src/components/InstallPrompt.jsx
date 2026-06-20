import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * InstallPrompt — invisible component.
 * - Captures beforeinstallprompt so InstallButton can use window.deferredPrompt
 * - Manages a two-step overlay: "Installing..." -> "Installed! Open App"
 */
const InstallPrompt = () => {
    // 'hidden' | 'installing' | 'installed'
    const [installState, setInstallState] = useState('hidden')

    useEffect(() => {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        if (isStandalone) return

        const handleBeforeInstall = (e) => {
            e.preventDefault()
            window.deferredPrompt = e
        }

        // Fired by Chrome when installation is fully complete
        const handleAppInstalled = () => {
            window.deferredPrompt = null
            setInstallState('installed')
        }

        // Fired by our InstallButton immediately when user taps "Install"
        const handleInstallAccepted = () => {
            window.deferredPrompt = null
            setInstallState('installing')
            
            // Safety fallback: if Chrome fails to fire 'appinstalled', 
            // we assume installation finishes after 6 seconds.
            setTimeout(() => {
                setInstallState(prev => prev === 'installing' ? 'installed' : prev)
            }, 6000)
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
        // This works if Android has fully finished installing the APK
        window.open(window.location.origin, '_blank', 'noopener')
    }

    const handleContinueInBrowser = () => {
        setInstallState('hidden')
    }

    if (installState === 'hidden') return null

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
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    animation: 'pgFadeIn 0.3s ease forwards',
                }}
            >
                {/* Card */}
                <div
                    style={{
                        width: '100%',
                        maxWidth: 340,
                        background: '#ffffff',
                        borderRadius: 24,
                        padding: '32px 24px 24px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        animation: 'pgSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
                    }}
                >
                    {/* Icon */}
                    <div style={{ position: 'relative', marginBottom: 20 }}>
                        <img
                            src="/icon-192.png"
                            alt="PrintGet"
                            style={{
                                width: 52,
                                height: 52,
                                borderRadius: 14,
                                display: 'block',
                            }}
                        />
                        {/* Status Badge */}
                        {installState === 'installed' ? (
                            <div style={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: '#16a34a',
                                border: '2.5px solid #fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: 'pgPopIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
                            }}>
                                <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                                    <path d="M2.5 6.5L5.5 9.5L10.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        ) : (
                            <div style={{
                                position: 'absolute',
                                bottom: -4,
                                right: -4,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: '#f59e0b',
                                border: '2.5px solid #fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <Loader2 className="w-3 h-3 text-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Heading */}
                    <p style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#111827',
                        margin: '0 0 6px',
                        lineHeight: 1.25,
                    }}>
                        {installState === 'installed' ? 'App Installed! 🎉' : 'Installing App... ⏳'}
                    </p>

                    {/* Body */}
                    <p style={{
                        fontSize: 13.5,
                        color: '#6b7280',
                        lineHeight: 1.55,
                        margin: '0 0 24px',
                        minHeight: 42,
                    }}>
                        {installState === 'installed' 
                            ? 'PrintGet is now on your home screen. Open the app for a faster, full-screen experience.'
                            : 'Please wait a moment while PrintGet is being added to your home screen...'}
                    </p>

                    {/* Action Area */}
                    <div style={{ width: '100%', minHeight: 48, marginBottom: 12 }}>
                        {installState === 'installed' ? (
                            <button
                                onClick={handleOpenApp}
                                style={{
                                    width: '100%',
                                    padding: '14px 20px',
                                    borderRadius: 14,
                                    border: 'none',
                                    background: '#111827',
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: 15,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    animation: 'pgFadeIn 0.3s ease',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Open PrintGet App
                            </button>
                        ) : (
                            <div style={{
                                width: '100%',
                                padding: '14px 20px',
                                borderRadius: 14,
                                background: '#f3f4f6',
                                color: '#9ca3af',
                                fontWeight: 600,
                                fontSize: 15,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                            }}>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Installing...
                            </div>
                        )}
                    </div>

                    {/* Stay in browser */}
                    <button
                        onClick={handleContinueInBrowser}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: 13,
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontWeight: 500,
                        }}
                    >
                        {installState === 'installed' ? 'Continue in browser' : 'Close'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pgFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pgSlideUp {
                    from { opacity: 0; transform: translateY(36px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pgPopIn {
                    from { opacity: 0; transform: scale(0.3); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </>
    )
}

export default InstallPrompt
