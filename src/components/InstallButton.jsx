import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

const InstallButton = ({ className = "", fullOnMobile = false }) => {
    const [canInstall, setCanInstall] = useState(false);

    useEffect(() => {
        // Show button if prompt was already captured by the inline script in index.html
        if (window.deferredPrompt) {
            setCanInstall(true);
        }

        // pwa-prompt-ready fires when beforeinstallprompt is captured (even if React wasn't ready)
        const handlePromptReady = () => {
            if (window.deferredPrompt) setCanInstall(true);
        };

        window.addEventListener('pwa-prompt-ready', handlePromptReady);
        // Also catch it directly in case timing works out
        window.addEventListener('beforeinstallprompt', handlePromptReady);

        return () => {
            window.removeEventListener('pwa-prompt-ready', handlePromptReady);
            window.removeEventListener('beforeinstallprompt', handlePromptReady);
        };
    }, []);

    const handleInstall = async () => {
        if (!window.deferredPrompt) return;
        
        try {
            // Show the native Chrome install prompt
            await window.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const { outcome } = await window.deferredPrompt.userChoice;
            
            // The deferredPrompt can only be used ONCE. 
            // We must clear it regardless of whether they accepted or dismissed it.
            window.deferredPrompt = null;
            setCanInstall(false);
            
            if (outcome === 'accepted') {
                // Trigger our success overlay
                window.dispatchEvent(new Event('pwa-install-accepted'));
            }
        } catch (error) {
            console.error('PWA Install Error:', error);
            // If the prompt fails (e.g. was already called), clear the stale event
            window.deferredPrompt = null;
            setCanInstall(false);
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
