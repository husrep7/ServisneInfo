import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandMark, Icon } from '../components/Icon';
import { isLoggedIn } from './auth';
import { errorText, verifyToken } from './api';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState('');
  const [error, setError] = useState(params.get('expired') ? 'Sesija je istekla ili token više ne važi. Unesite ga ponovo.' : '');
  const [busy, setBusy] = useState(false);

  if (isLoggedIn()) return <Navigate to="/admin" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (await verifyToken(token.trim())) navigate('/admin', { replace: true });
      else setError('Pogrešan admin token.');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <form className="tile admin-login-card reveal" onSubmit={onSubmit}>
        <div className="admin-login-head">
          <BrandMark size={44} />
          <h1 className="admin-login-title">ServisneInfo Admin</h1>
          <p className="admin-login-sub">Moderacija prijava i pregled izvora</p>
        </div>
        <label>
          <span className="form-label">Admin token</span>
          <input
            className="field-input"
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {error && <div className="form-error" role="alert"><Icon name="alert" size={17} /> {error}</div>}
        <button className="btn primary block" type="submit" disabled={busy || !token.trim()}>
          {busy ? 'Provjera…' : 'Prijavi se'}
        </button>
        <p className="form-hint">Token je <code>ADMIN_TOKEN</code> sa backenda. Čuva se samo dok je ovaj tab otvoren.</p>
      </form>
    </div>
  );
}
