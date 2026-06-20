import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const InstallButton = ({ className = "", fullOnMobile = false }) => {
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        // Check periodically if deferredPrompt is available
        const interval = setInterval(() => {
            if (window.deferredPrompt) {
                setCanInstall(true);
                clearInterval(interval);
            }
        }, 1000);

        // Also check immediately
        if (window.deferredPrompt) {
            setCanInstall(true);
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, []);

    const handleInstall = async () => {
        if (!window.deferredPrompt) return;
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setCanInstall(false);
            window.deferredPrompt = null;
            // Redirect into the installed PWA on the same visit
            setTimeout(() => {
                window.location.href = window.location.href;
            }, 1500);
        }
    };

    if (!canInstall) return null;

    return (
        <button
            onClick={handleInstall}
            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl text-sm font-bold hover:bg-blue-600 hover:text-white transition-all active:scale-95 shadow-sm group ${className}`}
        >
            <Download className="w-4 h-4 text-blue-500 group-hover:text-white transition-colors" />
            <span className={fullOnMobile ? "" : "hidden sm:inline"}>Install App</span>
        </button>
    );
};

export default InstallButton;
