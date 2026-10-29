import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { isLoggedIn, logout } from './auth';
import { ADMIN_NAV } from './nav';
import './admin.css';


export default function AdminLayout() {
  const navigate = useNavigate();

  if (!isLoggedIn()) return <Navigate to="/admin/login" replace />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">ServisneInfo Admin</div>
        <nav className="admin-nav" aria-label="Admin navigacija">
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path ? `/admin/${item.path}` : '/admin'}
              end
              className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="admin-logout"
          onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}
        >
          Odjava
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
