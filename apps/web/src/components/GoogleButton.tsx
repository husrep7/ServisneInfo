import { useEffect, useRef, useState } from 'react';
import { fetchAuthConfig } from '../api';

// Google Identity Services: Google crta svoje dugme i vraća ID token (credential), koji
// backend provjerava (/auth/google). Bez GOOGLE_CLIENT_ID na backendu dugme je isključeno.

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('gsi')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function GoogleButton({ onCredential, label = 'signin_with' }: {
  onCredential: (credential: string) => void;
  label?: 'signin_with' | 'signup_with' | 'continue_with';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'off'>('loading');
  // Callback se mijenja sa svakim renderom; Google ga pamti pri initialize
  const cb = useRef(onCredential);
  useEffect(() => { cb.current = onCredential; }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    fetchAuthConfig()
      .then(async ({ googleClientId }) => {
        if (!googleClientId) throw new Error('off');
        await loadScript();
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: googleClientId, callback: r => cb.current(r.credential) });
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill',
          text: label, width: Math.min(ref.current.offsetWidth || 360, 400), locale: 'bs',
        });
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('off'); });
    return () => { cancelled = true; };
  }, [label]);

  return (
    <div className="google-slot">
      <div ref={ref} className="google-btn-host" hidden={state !== 'ready'} />
      {state !== 'ready' && (
        <button type="button" className="btn secondary block google-fallback" disabled
          title={state === 'off' ? 'Google prijava još nije uključena' : undefined}>
          <GoogleG /> {state === 'loading' ? 'Učitavanje…' : 'Nastavi sa Google računom'}
        </button>
      )}
      {state === 'off' && import.meta.env.DEV && (
        <p className="auth-hint">Za Google prijavu postavite <code>GOOGLE_CLIENT_ID</code> u backend .env.</p>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
