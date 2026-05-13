import React, { useEffect, useState } from 'react'
import { Download, X, Printer } from 'lucide-react'

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [show, setShow] = useState(false)
    const [installing, setInstalling] = useState(false)

    useEffect(() => {
        // Don't show if already running as installed PWA
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true

        if (isStandalone) return

        const handler = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setShow(true)
        }

        window.addEventListener('beforeinstallprompt', handler)

        // If the event already fired before this component mounted, re-show after short delay
        const timer = setTimeout(() => {
            if (!deferredPrompt) {
                // Try to re-trigger visibility if event was already captured globally
            }
        }, 1500)

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            clearTimeout(timer)
        }
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return
        setInstalling(true)
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setInstalling(false)
        if (outcome === 'accepted') {
            setShow(false)
            setDeferredPrompt(null)
        } else {
            // User dismissed native prompt — keep our banner visible for next time
            setInstalling(false)
        }
    }

    const handleDismiss = () => {
        setShow(false)
    }

    if (!show) return null

    return (
        <>
            {/* Backdrop blur on mobile */}
            <div
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] sm:hidden"
                onClick={handleDismiss}
            />

            {/* Banner */}
            <div
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
                style={{
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
            >
                <div
                    style={{
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #4f46e5 100%)',
                        borderRadius: '20px',
                        padding: '1px',
                        boxShadow: '0 20px 60px rgba(37, 99, 235, 0.45), 0 8px 25px rgba(0,0,0,0.2)',
                    }}
                >
                    <div
                        style={{
                            background: 'linear-gradient(135deg, rgba(30,58,138,0.97) 0%, rgba(37,99,235,0.97) 100%)',
                            borderRadius: '19px',
                            padding: '16px 18px',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            {/* Icon */}
                            <div
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 14,
                                    background: 'rgba(255,255,255,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                }}
                            >
                                <img
                                    src="/icon-192.png"
                                    alt="PrintGet"
                                    style={{ width: 36, height: 36, borderRadius: 8 }}
                                />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2, marginBottom: 2 }}>
                                    Install PrintGet App
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 1.4 }}>
                                    Print from your home screen — no browser needed
                                </p>
                            </div>

                            {/* Dismiss */}
                            <button
                                onClick={handleDismiss}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: 6,
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.6)',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Install Button */}
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            style={{
                                marginTop: 12,
                                width: '100%',
                                background: installing
                                    ? 'rgba(255,255,255,0.2)'
                                    : 'rgba(255,255,255,0.95)',
                                color: installing ? 'rgba(255,255,255,0.7)' : '#1e3a8a',
                                border: 'none',
                                borderRadius: 12,
                                padding: '10px 16px',
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: installing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'all 0.2s ease',
                                letterSpacing: 0.2,
                            }}
                        >
                            <Download size={16} />
                            {installing ? 'Installing…' : 'Add to Home Screen'}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(24px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `}</style>
        </>
    )
}

export default InstallPrompt
