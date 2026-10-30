import { listScraperRuns } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle } from '../components';

export default function Sources() {
  const { data, error, loading, reload } = useLoad(listScraperRuns);
  const runs = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Izvori">
        <button className="admin-secondary" onClick={reload} disabled={loading}>Osvježi</button>
      </PageTitle>
      <LoadState loading={loading && !data} error={error} empty={!!data && runs.length === 0} onRetry={reload} />

      {runs.length > 0 && (
        <ul className="admin-rows">
          {runs.map(r => (
            <li key={r.source}>
              <span className={`admin-dot ${r.error ? 'bad' : 'ok'}`} aria-label={r.error ? 'Greška' : 'Radi'} />
              <span className="admin-row-main">
                {r.source}
                <span className="admin-muted">
                  {r.error ? ` · ${r.error}` : ` · pronađeno ${r.incidents_found}, novih ${r.incidents_new}`}
                </span>
              </span>
              <span className="admin-time">{fmtDateTime(r.ran_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
