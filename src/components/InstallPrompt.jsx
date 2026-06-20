import { useEffect, useState } from 'react'

/**
 * InstallPrompt — simple overlay that appears ONLY when the installation finishes.
 */
const InstallPrompt = () => {
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true
        if (isStandalone) return

        // Wait for the exact moment Chrome finishes the background installation
        const handleAppInstalled = () => {
            window.deferredPrompt = null
            setShowSuccess(true)
        }

        // Listen for the event fired by our index.html script when Chrome finishes installing
        window.addEventListener('pwa-app-installed', handleAppInstalled)
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
            window.removeEventListener('pwa-app-installed', handleAppInstalled)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const handleOpenApp = () => {
        window.open(window.location.origin, '_blank', 'noopener')
    }

    if (!showSuccess) return null

    return (
        <>
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
                        <div style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: '#2563eb',
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
                    </div>

                    <p style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#111827',
                        margin: '0 0 6px',
                        lineHeight: 1.25,
                    }}>
                        App Installed
                    </p>

                    <p style={{
                        fontSize: 13.5,
                        color: '#6b7280',
                        lineHeight: 1.55,
                        margin: '0 0 24px',
                    }}>
                        PrintGet is now on your home screen. Open the app for a full-screen experience.
                    </p>

                    <button
                        onClick={handleOpenApp}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: 14,
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 15,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Open PrintGet App
                    </button>

                    <button
                        onClick={() => setShowSuccess(false)}
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
                        Close
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
