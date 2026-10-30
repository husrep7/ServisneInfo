import { useState } from 'react';
import { Link } from 'react-router-dom';
import { closeIncident, errorText, listActiveIncidents, type AdminIncident } from '../api';
import { useLoad } from '../useLoad';
import { fmtDateTime } from '../format';
import { ConfirmDialog, LoadState, Notice, PageTitle, RefreshButton, TypeChip } from '../components';
import { TYPE_SHORT } from '../../types';

export default function Incidents() {
  const { data, error, loading, reload } = useLoad(listActiveIncidents);
  const [busy, setBusy] = useState<string | null>(null);
  const [closing, setClosing] = useState<AdminIncident | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function close(i: AdminIncident) {
    setClosing(null);
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
      <PageTitle title="Aktivni prekidi" sub="Ručno se zatvaraju samo prekidi nastali iz prijava građana">
        <RefreshButton onClick={reload} loading={loading} />
      </PageTitle>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      <LoadState loading={loading && !data} error={error} empty={!!data && incidents.length === 0} emptyTitle="Nema aktivnih prekida" onRetry={reload} />

      {incidents.length > 0 && (
        <ul className="tile admin-rows">
          {incidents.map(i => (
            <li key={i.id}>
              <TypeChip type={i.type} />
              <span className="admin-row-main">
                <Link className="admin-row-title" to={`/incidents/${i.id}`}>{i.title}</Link>
                <span className="admin-muted">{TYPE_SHORT[i.type]} · od {fmtDateTime(i.starts_at)}</span>
              </span>
              {i.origin === 'user'
                ? (
                  <>
                    <span className="admin-badge pending">prijave građana</span>
                    <button className="btn secondary sm admin-danger-btn" disabled={busy === i.id} onClick={() => setClosing(i)}>Zatvori</button>
                  </>
                )
                : <span className="admin-badge">službeno</span>}
            </li>
          ))}
        </ul>
      )}

      {closing && (
        <ConfirmDialog title="Zatvoriti prekid?" confirmLabel="Zatvori prekid"
          onConfirm={() => close(closing)} onCancel={() => setClosing(null)}>
          „{closing.title}“ se zatvara odmah. Prijave koje ga podržavaju biće označene kao odbijene.
        </ConfirmDialog>
      )}
    </div>
  );
}
