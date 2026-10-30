import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { plural } from '../../types';
import { listActiveIncidents, listBlocked, listReports, listScraperRuns } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle, RefreshButton, TypeChip } from '../components';

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
      <PageTitle title="Dashboard" sub="Šta danas traži pažnju">
        <RefreshButton onClick={reload} loading={loading} />
      </PageTitle>
      <LoadState loading={loading && !data} error={error} empty={false} onRetry={reload} />

      {data && (
        <div className="admin-bento">
          <Link to="/admin/prijave" className="tile admin-hero">
            <span className={`live-label${data.pending.length ? '' : ' ok'}`}>
              {data.pending.length ? 'Čeka pregled' : 'Sve je pregledano'}
            </span>
            <span className="hero-count mono">{data.pending.length}</span>
            <span className="admin-hero-foot">
              {plural(data.pending.length, 'prijava na čekanju', 'prijave na čekanju', 'prijava na čekanju')}
              <Icon name="arrow" size={18} className="btn-arrow" />
            </span>
          </Link>

          <Link to="/admin/prekidi" className="tile admin-stat">
            <span className="tile-label">Aktivni prekidi</span>
            <span className="admin-stat-value mono">{data.incidents.length}</span>
          </Link>
          <Link to="/admin/prekidi" className="tile admin-stat">
            <span className="tile-label">Od prijava građana</span>
            <span className="admin-stat-value mono">{userIncidents.length}</span>
          </Link>
          <Link to="/admin/blokirani" className="tile admin-stat">
            <span className="tile-label">Blokirani prijavioci</span>
            <span className="admin-stat-value mono">{data.blocked.length}</span>
          </Link>
          <Link to="/admin/izvori" className={`tile admin-stat${failing.length ? ' warn' : ''}`}>
            <span className="tile-label">Izvori rade</span>
            <span className="admin-stat-value mono">{data.runs.length - failing.length}/{data.runs.length}</span>
          </Link>

          <section className="tile admin-wide">
            <h2 className="admin-section-title">Najnovije prijave na čekanju</h2>
            {data.pending.length === 0
              ? <p className="admin-muted">Nema prijava na čekanju.</p>
              : (
                <ul className="admin-mini-list">
                  {data.pending.slice(0, 5).map(r => (
                    <li key={r.id}>
                      <TypeChip type={r.type} />
                      <span className="admin-row-main">
                        <span className="admin-row-title">{r.title}</span>
                        <span className="admin-muted">{r.address}</span>
                      </span>
                      <span className="admin-time mono">{fmtDateTime(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="tile admin-narrow">
            <h2 className="admin-section-title">Izvori</h2>
            <ul className="admin-mini-list">
              {data.runs.map(r => (
                <li key={r.source}>
                  <span className={`admin-dot ${r.error ? 'bad' : 'ok'}`} aria-label={r.error ? 'Greška' : 'Radi'} />
                  <span className="admin-row-main"><span className="admin-row-title">{r.source}</span></span>
                  <span className="admin-time mono">{fmtDateTime(r.ran_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
