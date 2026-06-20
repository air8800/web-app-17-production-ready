import { useEffect, useState } from 'react'

/**
 * InstallPrompt — invisible component.
 * - Captures beforeinstallprompt so InstallButton can use window.deferredPrompt
 * - Shows a clean "App Installed!" overlay ONLY after the browser fires `appinstalled`
 *   (i.e. after Chrome has actually finished installing — not on button click)
 */
const InstallPrompt = () => {
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        // Already inside the installed PWA — nothing to do
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        if (isStandalone) return

        // Capture install prompt for InstallButton to use
        const handleBeforeInstall = (e) => {
            e.preventDefault()
            window.deferredPrompt = e
        }

        // Show overlay ONLY when the browser confirms the app is installed.
        // This fires after Chrome actually adds it to the home screen/taskbar.
        const handleAppInstalled = () => {
            window.deferredPrompt = null
            setShowSuccess(true)
        }

        // Chrome 91+ deprecated the appinstalled event — it may never fire.
        // InstallButton dispatches this custom event after userChoice === 'accepted'.
        const handleInstallAccepted = () => {
            window.deferredPrompt = null
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
        // On Android Chrome: navigation to start_url is intercepted → opens PWA window
        // On Desktop Chrome/Edge: opens the installed app window
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
                    background: 'rgba(8, 15, 40, 0.72)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    animation: 'pgFadeIn 0.3s ease forwards',
                }}
            >
                {/* Card — slides up, NO scale to avoid zoom feel on mobile */}
                <div
                    style={{
                        width: '100%',
                        maxWidth: 360,
                        background: '#ffffff',
                        borderRadius: 28,
                        padding: '36px 24px 24px',
                        boxShadow: '0 24px 72px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        animation: 'pgSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
                    }}
                >
                    {/* Icon — clean, no spinning ring */}
                    <div style={{ position: 'relative', marginBottom: 22 }}>
                        <img
                            src="/icon-192.png"
                            alt="PrintGet"
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 18,
                                display: 'block',
                            }}
                        />
                        {/* Green checkmark badge */}
                        <div style={{
                            position: 'absolute',
                            bottom: -5,
                            right: -5,
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: '#16a34a',
                            border: '2.5px solid #fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pgPopIn 0.4s 0.25s cubic-bezier(0.16,1,0.3,1) both',
                        }}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M2.5 6.5L5.5 9.5L10.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* Heading */}
                    <p style={{
                        fontSize: 21,
                        fontWeight: 800,
                        color: '#0f172a',
                        margin: '0 0 8px',
                        letterSpacing: '-0.3px',
                        lineHeight: 1.25,
                    }}>
                        App Installed! 🎉
                    </p>

                    {/* Body */}
                    <p style={{
                        fontSize: 14,
                        color: '#64748b',
                        lineHeight: 1.6,
                        margin: '0 0 28px',
                    }}>
                        PrintGet is on your home screen. Open the app now for a faster, full-screen experience.
                    </p>

                    {/* Open App CTA */}
                    <button
                        onClick={handleOpenApp}
                        style={{
                            width: '100%',
                            padding: '15px 20px',
                            borderRadius: 16,
                            border: 'none',
                            background: 'linear-gradient(135deg, #1d4ed8, #4f46e5)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 15.5,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 6px 20px rgba(37,99,235,0.38)',
                            marginBottom: 14,
                            letterSpacing: '-0.1px',
                        }}
                    >
                        {/* External link icon */}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Open PrintGet App
                    </button>

                    {/* Stay in browser */}
                    <button
                        onClick={handleContinueInBrowser}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: 13,
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontWeight: 500,
                        }}
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
