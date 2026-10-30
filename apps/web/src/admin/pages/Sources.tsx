import { listScraperRuns } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle, RefreshButton } from '../components';

export default function Sources() {
  const { data, error, loading, reload } = useLoad(listScraperRuns);
  const runs = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Izvori" sub="Zadnje pokretanje svakog scrapera">
        <RefreshButton onClick={reload} loading={loading} />
      </PageTitle>
      <LoadState loading={loading && !data} error={error} empty={!!data && runs.length === 0} emptyTitle="Scraperi još nisu pokrenuti" onRetry={reload} />

      {runs.length > 0 && (
        <ul className="admin-sources">
          {runs.map(r => (
            <li key={r.source} className={`tile admin-source${r.error ? ' bad' : ''}`}>
              <div className="admin-source-head">
                <span className={`admin-dot ${r.error ? 'bad' : 'ok'}`} aria-hidden="true" />
                <span className="admin-row-title">{r.source}</span>
                <span className={`admin-badge ${r.error ? 'rejected' : 'confirmed'}`}>{r.error ? 'Greška' : 'Radi'}</span>
              </div>
              {r.error
                ? <p className="admin-source-error">{r.error}</p>
                : (
                  <dl className="admin-source-stats">
                    <div><dt>Pronađeno</dt><dd className="mono">{r.incidents_found}</dd></div>
                    <div><dt>Novih</dt><dd className="mono">{r.incidents_new}</dd></div>
                  </dl>
                )}
              <span className="admin-time mono">{fmtDateTime(r.ran_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
