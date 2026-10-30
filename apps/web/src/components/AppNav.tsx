import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandMark, Icon } from './Icon';
import type { IconName } from './Icon';

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/',         label: 'Početna', icon: 'home' },
  { to: '/map',      label: 'Mapa',    icon: 'map'  },
  { to: '/settings', label: 'Profil',  icon: 'user' },
];

// Na mobitelu traka dole, na desktopu header gore (vidi .app-nav u index.css)
export function AppNav() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;
  // Detalji i prijava imaju svoje dugme za nazad — na mobitelu bez trake
  const hideOnMobile = pathname.startsWith('/incidents/') || pathname === '/report';

  const cls = ({ isActive }: { isActive: boolean }) => `app-nav-link${isActive ? ' active' : ''}`;

  return (
    <nav className={`app-nav${hideOnMobile ? ' app-nav--hide-mobile' : ''}`} aria-label="Glavna navigacija">
      <div className="app-nav-inner">
        <Link to="/" className="app-nav-brand"><BrandMark /> ServisneInfo</Link>
        <div className="app-nav-links">
          {LINKS.slice(0, 2).map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={cls}>
              <Icon name={l.icon} size={22} /> {l.label}
            </NavLink>
          ))}
          <NavLink to="/report" className={({ isActive }) => `${cls({ isActive })} report`}>
            <span className="report-dot"><Icon name="plus" size={20} strokeWidth={2.6} /></span> Prijavi
          </NavLink>
          {LINKS.slice(2).map(l => (
            <NavLink key={l.to} to={l.to} className={cls}>
              <Icon name={l.icon} size={22} /> {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
