import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, Icon } from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { listReports } from './api';
import { isLoggedIn, logout } from './auth';
import { ADMIN_NAV } from './nav';
import { useLoad } from './useLoad';
import './admin.css';

export default function AdminLayout() {
  if (!isLoggedIn()) return <Navigate to="/admin/login" replace />;
  return <AdminShell />;
}

function AdminShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  // Broj na stavci Prijave; osvježava se pri svakoj promjeni stranice
  const { data: pending, reload: reloadPending } = useLoad(() => listReports('pending'), [pathname]);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="topbar-brand">
          <BrandMark size={30} />
          <span>ServisneInfo<small>Admin</small></span>
        </Link>
        <nav className="admin-nav" aria-label="Admin navigacija">
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path ? `/admin/${item.path}` : '/admin'}
              end
              aria-label={item.label}
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={19} />
              <span className="admin-nav-label">{item.label}</span>
              {item.path === 'prijave' && !!pending?.length && (
                <span className="admin-nav-count mono">{pending.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <button className="icon-btn" onClick={toggle}
            aria-label={theme === 'dark' ? 'Uključi svijetlu temu' : 'Uključi tamnu temu'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
          <button
            className="btn secondary sm admin-logout"
            onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}
          >
            <Icon name="logout" size={15} /> Odjava
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet context={reloadPending} />
      </main>
    </div>
  );
}
