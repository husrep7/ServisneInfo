import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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
      <form className="admin-login-card" onSubmit={onSubmit}>
        <h1 className="admin-login-title">ServisneInfo Admin</h1>
        <label className="admin-field">
          <span>Admin token</span>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <button className="admin-button" type="submit" disabled={busy || !token.trim()}>
          {busy ? 'Provjera…' : 'Prijavi se'}
        </button>
        <p className="admin-hint">Token je <code>ADMIN_TOKEN</code> sa backenda. Čuva se samo dok je ovaj tab otvoren.</p>
      </form>
    </div>
  );
}
