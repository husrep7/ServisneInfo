import { Link } from 'react-router-dom';
import { listActiveIncidents, listBlocked, listReports, listScraperRuns } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle } from '../components';
import { TYPE_ICON } from '../../types';

async function loadOverview() {
  const [pending, incidents, blocked, runs] = await Promise.all([
    listReports('pending'), listActiveIncidents(), listBlocked(), listScraperRuns(),
  ]);
  return { pending, incidents, blocked, runs };
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad(loadOverview);

  const userIncidents = data?.incidents.filter(i => i.origin === 'user') ?? [];
  const failing = data?.runs.filter(r => r.error) ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Dashboard">
        <button className="admin-secondary" onClick={reload} disabled={loading}>Osvježi</button>
      </PageTitle>
      <LoadState loading={loading && !data} error={error} empty={false} onRetry={reload} />

      {data && (
        <>
          <div className="admin-stats">
            <Link to="/admin/prijave" className="admin-stat">
              <span className="admin-stat-value">{data.pending.length}</span>
              <span className="admin-stat-label">Prijave na čekanju</span>
            </Link>
            <Link to="/admin/prekidi" className="admin-stat">
              <span className="admin-stat-value">{data.incidents.length}</span>
              <span className="admin-stat-label">Aktivni prekidi</span>
            </Link>
            <Link to="/admin/prekidi" className="admin-stat">
              <span className="admin-stat-value">{userIncidents.length}</span>
              <span className="admin-stat-label">Od prijava građana</span>
            </Link>
            <Link to="/admin/blokirani" className="admin-stat">
              <span className="admin-stat-value">{data.blocked.length}</span>
              <span className="admin-stat-label">Blokirani prijavioci</span>
            </Link>
            <Link to="/admin/izvori" className={`admin-stat${failing.length ? ' warn' : ''}`}>
              <span className="admin-stat-value">{data.runs.length - failing.length}/{data.runs.length}</span>
              <span className="admin-stat-label">Izvori rade</span>
            </Link>
          </div>

          <h2 className="admin-section-title">Najnovije prijave na čekanju</h2>
          {data.pending.length === 0
            ? <div className="admin-empty">Nema prijava na čekanju.</div>
            : (
              <ul className="admin-rows">
                {data.pending.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <span aria-hidden="true">{TYPE_ICON[r.type]}</span>
                    <span className="admin-row-main">{r.title}<span className="admin-muted"> · {r.address}</span></span>
                    <span className="admin-time">{fmtDateTime(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </div>
  );
}
