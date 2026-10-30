import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { logout } from '../auth';
import { PageTitle } from '../components';

export default function Profile() {
  const navigate = useNavigate();
  return (
    <div className="admin-page">
      <PageTitle title="Profil" />
      <div className="tile admin-panel">
        <span className="admin-icon-chip"><Icon name="shield" size={19} /></span>
        <p>Prijavljeni ste admin tokenom (<code>ADMIN_TOKEN</code>). Token se čuva samo u ovom tabu i briše se kad ga zatvorite.</p>
        <p className="admin-muted">Pravi admin računi sa lozinkama nisu dio v1 (KTD8).</p>
        <button className="btn secondary sm" onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}>
          <Icon name="logout" size={15} /> Odjava
        </button>
      </div>
    </div>
  );
}
