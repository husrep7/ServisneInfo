import { useNavigate } from 'react-router-dom';
import { logout } from '../auth';
import { PageTitle } from '../components';

export default function Profile() {
  const navigate = useNavigate();
  return (
    <div className="admin-page">
      <PageTitle title="Profil" />
      <div className="admin-panel">
        <p>Prijavljeni ste admin tokenom (<code>ADMIN_TOKEN</code>). Token se čuva samo u ovom tabu i briše se kad ga zatvorite.</p>
        <p className="admin-muted">Pravi admin računi sa lozinkama nisu dio v1 (KTD8).</p>
        <button className="admin-btn" onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}>Odjava</button>
      </div>
    </div>
  );
}
