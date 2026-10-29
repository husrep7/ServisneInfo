import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isLoggedIn, login } from './auth';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isLoggedIn()) return <Navigate to="/admin" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await login(username, password);
    setBusy(false);
    if (ok) navigate('/admin', { replace: true });
    else setError('Pogrešno korisničko ime ili lozinka.');
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={onSubmit}>
        <h1 className="admin-login-title">ServisneInfo Admin</h1>
        <label className="admin-field">
          <span>Korisničko ime</span>
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="admin-field">
          <span>Lozinka</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <button className="admin-button" type="submit" disabled={busy}>
          {busy ? 'Prijava…' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}
