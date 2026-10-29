import { Navigate, useNavigate } from 'react-router-dom';
import { isLoggedIn, logout } from './auth';
import './admin.css';

export default function AdminLayout() {
  const navigate = useNavigate();

  if (!isLoggedIn()) return <Navigate to="/admin/login" replace />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">ServisneInfo Admin</div>
        <button
          className="admin-logout"
          onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}
        >
          Odjava
        </button>
      </aside>
      <main className="admin-main" />
    </div>
  );
}
