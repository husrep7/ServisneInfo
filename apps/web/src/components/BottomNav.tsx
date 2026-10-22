import { NavLink, useNavigate, useLocation } from 'react-router-dom';

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconMap({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconUser({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const tabs = [
  { to: '/',         Icon: IconHome, label: 'Početna' },
  { to: '/map',      Icon: IconMap,  label: 'Mapa'    },
  { to: '/settings', Icon: IconUser, label: 'Profil'  },
];

const HIDE_FLOATING = ['/settings', '/report', '/incidents/'];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showFloating = !HIDE_FLOATING.some(p => pathname.startsWith(p));

  return (
    <>
      {showFloating && (
        <button onClick={() => navigate('/report')} style={{
          position: 'fixed', bottom: 84, left: '50%',
          transform: 'translateX(-50%)',
          background: '#ED1D1D', color: '#fff', border: 'none',
          borderRadius: 28, padding: '12px 22px',
          fontSize: 14, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(237,29,29,.4)',
          display: 'flex', alignItems: 'center', gap: 8,
          zIndex: 99, letterSpacing: .3,
          fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 16 }}>📢</span>
          Prijavi incident
        </button>
      )}

      <nav className="bottom-nav">
        {tabs.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }: { isActive: boolean }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <Icon active={isActive} />
                <span className="nav-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
