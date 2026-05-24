import { useEffect, useState } from 'react';

/**
 * Google OAuth redirect target for the PrintGet desktop app.
 * Supabase redirects here with tokens in the URL hash after sign-in.
 */
export default function DesktopAuthCallbackPage() {
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error_description') || params.get('error');

    if (error) {
      setMessage(`Sign-in failed: ${decodeURIComponent(error)}`);
      return;
    }

    if (accessToken) {
      setMessage('Sign-in successful! You can close this tab and return to the PrintGet desktop app.');
      try {
        localStorage.setItem(
          'printget_desktop_oauth',
          JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            at: Date.now(),
          })
        );
      } catch {
        /* ignore */
      }
      return;
    }

    setMessage('No sign-in data received. Close this tab and try again from the desktop app.');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 mb-3">PrintGet Desktop</h1>
        <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
