import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useNow } from '../hooks';
import { BrandMark, Icon } from './Icon';
import type { IconName } from './Icon';

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/',         label: 'Početna', icon: 'home' },
  { to: '/map',      label: 'Mapa',    icon: 'map'  },
  { to: '/settings', label: 'Profil',  icon: 'user' },
];

function TopClock() {
  const now = new Date(useNow(1000));
  const t = now.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo' });
  return <span className="topbar-clock mono">{t}</span>;
}

// Gore: logo, sat i tema. Dole: plutajući dock (isti na mobitelu i desktopu)
export function AppNav() {
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  if (pathname.startsWith('/admin')) return null;

  const cls = ({ isActive }: { isActive: boolean }) => `dock-link${isActive ? ' active' : ''}`;
  const link = (l: typeof LINKS[number]) => (
    <NavLink key={l.to} to={l.to} end={l.to === '/'} className={cls} aria-label={l.label} title={l.label}>
      <Icon name={l.icon} size={21} />
      <span className="dock-label">{l.label}</span>
    </NavLink>
  );

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="topbar-brand">
            <BrandMark size={30} />
            <span>ServisneInfo<small>Kanton Sarajevo</small></span>
          </Link>
          <div className="topbar-actions">
            {pathname !== '/' && <TopClock />}
            <button className="icon-btn" onClick={toggle}
              aria-label={theme === 'dark' ? 'Uključi svijetlu temu' : 'Uključi tamnu temu'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </div>
      </header>

      <nav className="dock" aria-label="Glavna navigacija">
        {LINKS.slice(0, 2).map(link)}
        <NavLink to="/report" className={({ isActive }) => `dock-report${isActive ? ' active' : ''}`}>
          <Icon name="plus" size={18} strokeWidth={2.6} /> Prijavi
        </NavLink>
        {LINKS.slice(2).map(link)}
      </nav>
    </>
  );
}
