import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  blockReporter, confirmReport, errorText, listReports, rejectReport,
  type AdminReport, type ReportStatus,
} from '../api';
import { useLoad } from '../useLoad';
import { REPORT_STATUS_BADGE, REPORT_STATUS_LABEL, fmtDateTime } from '../format';
import { LoadState, PageTitle } from '../components';
import ReportsMap from '../ReportsMap';
import { TYPE_COLOR, TYPE_ICON, TYPE_SHORT } from '../../types';

const TABS: (ReportStatus | 'all')[] = ['pending', 'confirmed', 'rejected', 'expired', 'all'];

const SUPPRESSED_LABEL = { blocked: 'blokiran prijavilac', rate_limit: 'preko limita' } as const;

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS as string[]).includes(params.get('status') ?? '') ? params.get('status') as ReportStatus | 'all' : 'pending';
  const { data, error, loading, reload } = useLoad(() => listReports(tab), [tab]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const select = useCallback((id: string) => {
    setSelected(id);
    document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  async function act(r: AdminReport, action: 'confirm' | 'reject' | 'block') {
    let reason: string | undefined;
    if (action === 'block') {
      const answer = window.prompt(
        'Blokirati ovog prijavioca? Sve njegove prijave na čekanju nestaju, a nove se tiho odbacuju.\n\nRazlog (opciono):',
        '',
      );
      if (answer === null) return;
      reason = answer.trim();
    }
    setBusy(r.id);
    setNotice(null);
    try {
      if (action === 'confirm') {
        await confirmReport(r.id);
        setNotice({ kind: 'ok', text: 'Prijava je potvrđena i sada je prekid na početnoj stranici.' });
      } else if (action === 'reject') {
        await rejectReport(r.id);
        setNotice({ kind: 'ok', text: 'Prijava je odbijena.' });
      } else {
        await blockReporter(r.id, reason);
        setNotice({ kind: 'ok', text: 'Prijavilac je blokiran.' });
      }
      await reload();
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  const reports = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Prijave">
        <button className="admin-secondary" onClick={reload} disabled={loading}>Osvježi</button>
      </PageTitle>

      <div className="admin-tabs" role="tablist" aria-label="Status prijava">
        {TABS.map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            className={`admin-tab${t === tab ? ' active' : ''}`}
            onClick={() => { setSelected(null); setParams(t === 'pending' ? {} : { status: t }); }}
          >
            {t === 'all' ? 'Sve' : REPORT_STATUS_LABEL[t]}
          </button>
        ))}
      </div>

      {notice && (
        <div className={notice.kind === 'ok' ? 'admin-success' : 'admin-error'} role="status">{notice.text}</div>
      )}

      <LoadState loading={loading && !data} error={error} empty={!!data && reports.length === 0} onRetry={reload} />

      {reports.length > 0 && (
        <div className="admin-split">
          <ul className="admin-list">
            {reports.map(r => (
              <li
                key={r.id}
                id={`report-${r.id}`}
                className={`admin-card${selected === r.id ? ' selected' : ''}`}
              >
                <div className="admin-card-head">
                  <span className="admin-type" style={{ color: TYPE_COLOR[r.type] }}>
                    <span aria-hidden="true">{TYPE_ICON[r.type]}</span> {TYPE_SHORT[r.type]}
                  </span>
                  <span className={`admin-badge ${r.status}`}>{REPORT_STATUS_BADGE[r.status]}</span>
                  {r.suppressed && <span className="admin-badge muted">{SUPPRESSED_LABEL[r.suppressed]}</span>}
                  {r.blocked && <span className="admin-badge rejected">blokiran</span>}
                  <span className="admin-time">{fmtDateTime(r.created_at)}</span>
                </div>
                <div className="admin-card-title">{r.title}</div>
                {r.description && <p className="admin-card-text">{r.description}</p>}
                <dl className="admin-meta">
                  <dt>Adresa</dt>
                  <dd>
                    {r.address}{' '}
                    {r.lat == null
                      ? <span className="admin-muted">(bez tačke na mapi)</span>
                      : <button className="admin-link-btn" onClick={() => setSelected(r.id)}>Na mapi</button>}
                  </dd>
                  <dt>Ime</dt><dd>{r.reporter_name || '—'}</dd>
                  <dt>Kontakt</dt><dd>{r.contact || '—'}</dd>
                  <dt>Izvor</dt><dd>{r.channel === 'mobile' ? 'Mobilna' : 'Web'}</dd>
                  {r.incident_id && (
                    <><dt>Prekid</dt><dd><Link to={`/incidents/${r.incident_id}`}>Otvori</Link>{r.confirmed_by === 'admin' ? ' (potvrdio admin)' : ' (automatski)'}</dd></>
                  )}
                </dl>
                {r.status === 'pending' && (
                  <div className="admin-actions">
                    <button className="admin-btn ok" disabled={busy === r.id} onClick={() => act(r, 'confirm')}>Potvrdi</button>
                    <button className="admin-btn" disabled={busy === r.id} onClick={() => act(r, 'reject')}>Odbij</button>
                    {!r.blocked && r.reporter_key && !r.reporter_key.startsWith('ip:') && (
                      <button className="admin-btn danger" disabled={busy === r.id} onClick={() => act(r, 'block')}>Blokiraj prijavioca</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="admin-map-wrap">
            <ReportsMap reports={reports} selectedId={selected} onSelect={select} />
          </div>
        </div>
      )}
    </div>
  );
}
