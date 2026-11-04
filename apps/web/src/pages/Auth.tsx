import { useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage, forgotPassword, login, loginWithGoogle, register, resetPassword } from '../api';
import { setGuest, useSession } from '../session';
import { GoogleButton } from '../components/GoogleButton';
import { BrandMark, Icon, TypeIcon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import './auth.css';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

// Kuda nakon prijave: ?next=/map, samo interne putanje
function useNext(): string {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Icon name="pin" size={18} />,               title: 'Prekidi u vašoj ulici', text: 'Lokacija se prepozna odmah — vidite da li ste bez vode, struje ili gasa.' },
  { icon: <TypeIcon type="electricity" size={18} />,   title: 'Najbliži bankomat, pumpa, pošta', text: 'I upozorenje kad je objekat u zoni bez struje.' },
  { icon: <Icon name="map" size={18} />,               title: 'Zaobiđite radove',      text: 'Ruta koja ne prolazi kroz zonu radova u toku.' },
];

function Field({ label, icon, ...input }: { label: string; icon: IconName } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="auth-field">
      <span className="auth-label">{label}</span>
      <span className="auth-input">
        <Icon name={icon} size={17} />
        <input {...input} />
      </span>
    </label>
  );
}

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const session = useSession();
  const next = useNext();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [sent, setSent]         = useState(false);

  // Već prijavljen: nema šta raditi na ovim ekranima (osim reseta sa linkom iz emaila)
  if (session && mode !== 'reset') return <Navigate to={next} replace />;

  const token = params.get('token') ?? '';
  const withNext = (path: string) => (next !== '/' ? `${path}?next=${encodeURIComponent(next)}` : path);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (after) after(); else navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login')    run(() => login(email, password));
    if (mode === 'register') run(() => register(email, password, name));
    if (mode === 'forgot')   run(() => forgotPassword(email), () => setSent(true));
    if (mode === 'reset')    run(() => resetPassword(token, password), () => navigate('/', { replace: true }));
  };

  const google = (credential: string) => run(() => loginWithGoogle(credential));
  const continueAsGuest = () => { setGuest(true); navigate(next, { replace: true }); };

  const titles: Record<AuthMode, [string, string]> = {
    login:    ['Dobro došli nazad', 'Prijavite se da vidite šta se dešava u vašoj ulici.'],
    register: ['Napravite račun', 'Besplatno. Vaše adrese i obavijesti na jednom mjestu.'],
    forgot:   ['Zaboravljena lozinka', 'Upišite email računa — poslaćemo vam link za novu lozinku.'],
    reset:    ['Nova lozinka', 'Izaberite novu lozinku za svoj račun.'],
  };
  const [title, subtitle] = titles[mode];

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <Link to="/" className="auth-logo"><BrandMark size={34} /><span>ServisneInfo<small>Kanton Sarajevo</small></span></Link>
          <div>
            <h2 className="auth-claim">Sve što se dešava oko vas. <span>Na jednom mjestu.</span></h2>
            <ul className="auth-features">
              {FEATURES.map(f => (
                <li key={f.title}>
                  <span className="auth-feature-icon">{f.icon}</span>
                  <span><strong>{f.title}</strong>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="auth-brand-foot">Podaci: ViK, EPBiH, Sarajevogas, Toplane, BH Telecom i OpenStreetMap</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-logo auth-logo-mobile"><BrandMark size={30} /><span>ServisneInfo</span></Link>

          {(mode === 'login' || mode === 'register') && (
            <div className="auth-tabs" role="tablist">
              <Link role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} to={withNext('/prijava')}>Prijava</Link>
              <Link role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} to={withNext('/registracija')}>Registracija</Link>
            </div>
          )}

          <h1 className="auth-title">{title}</h1>
          <p className="auth-sub">{subtitle}</p>

          {mode === 'forgot' && sent ? (
            <div className="auth-sent">
              <span className="auth-sent-icon"><Icon name="mail" size={22} /></span>
              <div>
                <strong>Provjerite email</strong>
                Ako račun sa adresom <b>{email}</b> postoji, link za novu lozinku stiže za minut. Važi 60 minuta.
              </div>
            </div>
          ) : mode === 'reset' && !token ? (
            <div className="auth-error" role="alert">Link nije potpun. Otvorite link iz emaila ili zatražite novi.</div>
          ) : (
            <form className="auth-form" onSubmit={submit} noValidate={false}>
              {(mode === 'login' || mode === 'register') && (
                <>
                  <GoogleButton onCredential={google} label={mode === 'register' ? 'signup_with' : 'signin_with'} />
                  <div className="auth-or"><span>ili emailom</span></div>
                </>
              )}

              {mode === 'register' && (
                <Field label="Ime" icon="user" value={name} onChange={e => setName(e.target.value)}
                  autoComplete="given-name" placeholder="Kako da vas zovemo" maxLength={80} />
              )}
              {mode !== 'reset' && (
                <Field label="Email" icon="mail" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="email" placeholder="ime@primjer.ba" />
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'reset' ? 'Nova lozinka' : 'Lozinka'} icon="shield" type="password" required
                  minLength={mode === 'login' ? 1 : 8} value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? '••••••••' : 'Najmanje 8 znakova'} />
              )}

              {mode === 'login' && (
                <Link to="/zaboravljena-lozinka" className="auth-link auth-forgot">Zaboravili ste lozinku?</Link>
              )}

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button className="btn primary block lg" disabled={busy}>
                {busy ? 'Sačekajte…'
                  : mode === 'login' ? 'Prijavi se'
                  : mode === 'register' ? 'Napravi račun'
                  : mode === 'forgot' ? 'Pošalji link'
                  : 'Sačuvaj lozinku'}
                {!busy && <Icon name="arrow" size={17} className="btn-arrow" />}
              </button>
            </form>
          )}

          <div className="auth-foot">
            {mode === 'forgot' || mode === 'reset'
              ? <Link to="/prijava" className="auth-link"><Icon name="back" size={15} /> Nazad na prijavu</Link>
              : <button type="button" className="auth-link" onClick={continueAsGuest}>Nastavi bez računa</button>}
          </div>
          {mode === 'register' && (
            <p className="auth-legal">Registracijom prihvatate <Link to="/uslovi">uslove korištenja</Link> i <Link to="/privatnost">politiku privatnosti</Link>.</p>
          )}
        </div>
      </main>
    </div>
  );
}
