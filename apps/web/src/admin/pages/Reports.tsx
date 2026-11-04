import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  blockReporter, confirmReport, errorText, listReports, rejectReport,
  type AdminReport, type ReportStatus,
} from '../api';
import { useLoad } from '../useLoad';
import { REPORT_STATUS_BADGE, REPORT_STATUS_LABEL, fmtDateTime } from '../format';
import { ConfirmDialog, LoadState, Notice, PageTitle, RefreshButton, TypeChip } from '../components';
import ReportsMap from '../ReportsMap';
import { Segmented } from '../../components/Segmented';
import { TYPE_SHORT } from '../../types';

type Tab = ReportStatus | 'all';

const TABS: Tab[] = ['pending', 'confirmed', 'rejected', 'expired', 'all'];

const SUPPRESSED_LABEL = { blocked: 'blokiran prijavilac', rate_limit: 'preko limita' } as const;

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS as string[]).includes(params.get('status') ?? '') ? params.get('status') as Tab : 'pending';
  const { data, error, loading, reload } = useLoad(() => listReports(tab), [tab]);
  const reloadPending = useOutletContext<() => void>();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<AdminReport | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const select = useCallback((id: string) => {
    setSelected(id);
    document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // Na uskom ekranu tabovi se skrolaju; izabrani mora ostati vidljiv
  useEffect(() => {
    const scroller = tabsRef.current;
    const active = scroller?.querySelector<HTMLElement>('.seg-opt.on');
    if (scroller && active) scroller.scrollLeft = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
  }, [tab]);

  async function act(r: AdminReport, action: 'confirm' | 'reject' | 'block', reason?: string) {
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
      reloadPending();
    } catch (err) {
      setNotice({ kind: 'err', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  const reports = data ?? [];

  return (
    <div className="admin-page">
      <PageTitle title="Prijave" sub="Ime i kontakt prijavioca vidi samo admin">
        <RefreshButton onClick={reload} loading={loading} />
      </PageTitle>

      <div className="admin-seg-scroll" ref={tabsRef}>
        <Segmented<Tab>
          label="Status prijava"
          value={tab}
          options={TABS.map(t => ({ value: t, label: t === 'all' ? 'Sve' : REPORT_STATUS_LABEL[t] }))}
          onChange={t => { setSelected(null); setParams(t === 'pending' ? {} : { status: t }); }}
        />
      </div>

      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <LoadState loading={loading && !data} error={error} empty={!!data && reports.length === 0} emptyTitle="Nema prijava u ovoj grupi" onRetry={reload} />

      {reports.length > 0 && (
        <div className="admin-split">
          <ul className="admin-list">
            {reports.map(r => (
              <li
                key={r.id}
                id={`report-${r.id}`}
                className={`tile admin-card${selected === r.id ? ' selected' : ''}`}
              >
                <div className="admin-card-head">
                  <TypeChip type={r.type} />
                  <span className="admin-type">{TYPE_SHORT[r.type]}</span>
                  <span className={`admin-badge ${r.status}`}>{REPORT_STATUS_BADGE[r.status]}</span>
                  {r.suppressed && <span className="admin-badge">{SUPPRESSED_LABEL[r.suppressed]}</span>}
                  {r.blocked && <span className="admin-badge rejected">blokiran</span>}
                  <span className="admin-time mono">{fmtDateTime(r.created_at)}</span>
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
                    <><dt>Prekid</dt><dd><Link className="admin-link-btn" to={`/incidents/${r.incident_id}`}>Otvori</Link>{r.confirmed_by === 'admin' ? ' (potvrdio admin)' : ' (automatski)'}</dd></>
                  )}
                </dl>
                {r.status === 'pending' && (
                  <div className="admin-actions">
                    <button className="btn primary sm" disabled={busy === r.id} onClick={() => act(r, 'confirm')}>Potvrdi</button>
                    <button className="btn secondary sm" disabled={busy === r.id} onClick={() => act(r, 'reject')}>Odbij</button>
                    {!r.blocked && r.reporter_key && !r.reporter_key.startsWith('ip:') && (
                      <button className="btn secondary sm admin-danger-btn" disabled={busy === r.id} onClick={() => setBlocking(r)}>Blokiraj prijavioca</button>
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

      {blocking && (
        <ConfirmDialog title="Blokirati prijavioca?" confirmLabel="Blokiraj" withReason
          onConfirm={reason => { const r = blocking; setBlocking(null); act(r, 'block', reason); }}
          onCancel={() => setBlocking(null)}>
          Sve njegove prijave na čekanju nestaju, a nove se tiho odbacuju.
        </ConfirmDialog>
      )}
    </div>
  );
}
