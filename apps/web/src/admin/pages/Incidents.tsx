import { useState } from 'react';
import { Link } from 'react-router-dom';
import { closeIncident, errorText, listActiveIncidents, type AdminIncident } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { LoadState, PageTitle } from '../components';
import { TYPE_ICON, TYPE_SHORT } from '../../types';

export default function Incidents() {
  const { data, error, loading, reload } = useLoad(listActiveIncidents);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function close(i: AdminIncident) {
    if (!window.confirm(`Zatvoriti prekid "${i.title}"? Prijave koje ga podržavaju biće označene kao odbijene.`)) return;
    setBusy(i.id);
    setNotice(null);
    try {
      await closeIncident(i.id);
      setNotice({ kind: 'ok', text: 'Prekid je zatvoren.' });
      await reload();
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  const incidents = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Aktivni prekidi">
        <button className="admin-secondary" onClick={reload} disabled={loading}>Osvježi</button>
      </PageTitle>
      {notice && <div className={notice.kind === 'ok' ? 'admin-success' : 'admin-error'} role="status">{notice.text}</div>}
      <LoadState loading={loading && !data} error={error} empty={!!data && incidents.length === 0} onRetry={reload} />

      {incidents.length > 0 && (
        <ul className="admin-rows">
          {incidents.map(i => (
            <li key={i.id}>
              <span aria-hidden="true">{TYPE_ICON[i.type]}</span>
              <span className="admin-row-main">
                <Link to={`/incidents/${i.id}`}>{i.title}</Link>
                <span className="admin-muted"> · {TYPE_SHORT[i.type]} · od {fmtDateTime(i.starts_at)}</span>
              </span>
              {i.origin === 'user'
                ? (
                  <>
                    <span className="admin-badge pending">prijave građana</span>
                    <button className="admin-btn danger" disabled={busy === i.id} onClick={() => close(i)}>Zatvori</button>
                  </>
                )
                : <span className="admin-badge muted">službeno</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
