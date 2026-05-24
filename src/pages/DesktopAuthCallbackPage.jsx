import { useEffect, useState } from 'react';

/**
 * Google OAuth redirect for the PrintGet desktop app (production web fallback).
 * Sends tokens to the desktop app via printget:// deep link.
 */
export default function DesktopAuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error_description') || params.get('error');

    if (error) {
      setMessage(`Sign-in failed: ${decodeURIComponent(error)}`);
      return;
    }

    if (accessToken && hash) {
      setMessage('Opening PrintGet desktop app…');
      window.location.href = `printget://auth/callback#${hash}`;
      setTimeout(() => {
        setMessage(
          'Sign-in successful! If PrintGet did not open automatically, close this tab and return to the desktop app.'
        );
      }, 2500);
      return;
    }

    setMessage('No sign-in data received. Close this tab and try again from the desktop app.');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-3">PrintGet</h1>
        <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
