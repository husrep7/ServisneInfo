import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { fetchIncidents, connectWS } from '../api';
import { IncidentRow } from '../components/IncidentRow';
import type { Incident } from '../types';
import { COMPANIES } from '../types';
import { clickable } from '../a11y';

const DANI   = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const MJESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];

function formatSarajevoDate(date: Date): string {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Sarajevo' }));
  return `${DANI[d.getDay()]}, ${d.getDate()}. ${MJESECI[d.getMonth()]} ${d.getFullYear()}.`;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export default function Home() {
  const [all, setAll]           = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled'>('all');
  const [loading, setLoading]   = useState(true);
  // Sve grupe su zatvorene po defaultu
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set(COMPANIES.map(c => c.id))
  );

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const now = useClock();

  const load = useCallback(async () => {
    try {
      const [active, scheduled] = await Promise.all([
        fetchIncidents({ status: 'active',    limit: 100 }),
        fetchIncidents({ status: 'scheduled', limit: 100 }),
      ]);
      const data = [...active, ...scheduled];
      // Sortiraj po vremenu objave na sajtu preduzeća (created_at = kada je scraper pronašao)
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAll(data);
    } catch (err) {
      console.error('Učitavanje incidenata nije uspjelo', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ws = connectWS(load);
    const iv = setInterval(load, 60_000);
    return () => { ws.close(); clearInterval(iv); };
  }, [load]);

  const active    = all.filter(i => i.status === 'active');
  const scheduled = all.filter(i => i.status === 'scheduled');
  // Default: posljednjih 5 AKTIVNIH (koje su već stupile na snagu)
  // Aktivno/Planirano filter: sve iz te kategorije
  const displayed = statusFilter === 'all'
    ? active.slice(0, 5)
    : statusFilter === 'active'
    ? active
    : scheduled;
  const activeCount = active.length;

  return (
    <div className="page">
      {/* Header */}
      <div className="s-header">
        <div>
          <div className="s-header-label">Servisne Informacije</div>
          <div className="s-header-title header-title-row">
            Sarajevo
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="9" width="4" height="12"/><rect x="10" y="5" width="4" height="16"/><rect x="17" y="12" width="4" height="9"/><line x1="1" y1="21" x2="23" y2="21"/>
            </svg>
          </div>
        </div>
        <div className="header-meta">
          <div className="header-time">
            {now.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Sarajevo' })}
          </div>
          <div className="header-date">
            {formatSarajevoDate(now)}
          </div>
          {activeCount > 0 && (
            <span className="badge-live header-live-badge">
              {activeCount} aktivno
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="spinner"><div className="spinner-ring" /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-row stats-row-2">
            {[
              { label: 'Aktivno',   status: 'active'    as const, count: active.length,    color: 'var(--live)' },
              { label: 'Planirano', status: 'scheduled' as const, count: scheduled.length, color: 'var(--gold)' },
            ].map(s => {
              const isSelected = statusFilter === s.status;
              return (
                <div key={s.label} className={`stat-card${isSelected ? ' active' : ''}`}
                  {...clickable(() => setStatusFilter(isSelected ? 'all' : s.status))} aria-pressed={isSelected}
                  style={{ '--accent': s.color } as CSSProperties}>
                  <div className="stat-number">{s.count}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              );
            })}
          </div>



          {/* Naslov sekcije */}
          <div className="s-section">
            <span className="s-section-title">
              {statusFilter === 'active'    ? 'Aktivne obavijesti'
               : statusFilter === 'scheduled' ? 'Planirane obavijesti'
               : 'Posljednjih 5 obavijesti'}
            </span>
          </div>

          {displayed.length === 0 ? (
            <div className="empty" style={{ paddingTop: 40 }}>
              <div className="empty-icon">✅</div>
              <div className="empty-title">Sve je u redu</div>
              <div className="empty-sub">Nema komunalnih poremećaja u Sarajevu danas.</div>
            </div>
          ) : statusFilter === 'all' ? (
            // Default: flat lista posljednjih 5
            displayed.map(i => <IncidentRow key={i.id} incident={i} />)
          ) : (
            // Aktivno/Planirano: accordion po preduzeću
            COMPANIES.map(c => {
              const group = displayed.filter(i => i.type === c.type);
              if (group.length === 0) return null;
              const isOpen = !collapsed.has(c.id);
              const badgeColor = group.some(i => i.status === 'active') ? 'var(--live)' : 'var(--gold)';
              const activeInGroup = group.filter(i => i.status === 'active').length;
              const scheduledInGroup = group.filter(i => i.status === 'scheduled').length;

              return (
                <div key={c.id}>
                  <div className="company-row" {...clickable(() => toggleCollapse(c.id))} aria-expanded={isOpen}
                    style={{ '--accent': badgeColor } as CSSProperties}>
                    <div className="company-logo" style={{ width: 36, height: 36, '--company-bg': c.logoBg } as CSSProperties}>
                      <img src={c.logo} alt={c.shortName} style={{ width: 26, height: 26, objectFit: 'contain' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>

                    <div className="company-row-body">
                      <div className="company-row-name">{c.shortName}</div>
                      <div className="company-row-counts">
                        {activeInGroup > 0 && <span style={{ color: 'var(--live)', fontWeight: 700 }}>{activeInGroup} aktivno</span>}
                        {activeInGroup > 0 && scheduledInGroup > 0 && <span style={{ color: 'var(--text-muted)' }}> · </span>}
                        {scheduledInGroup > 0 && <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{scheduledInGroup} planirano</span>}
                      </div>
                    </div>

                    <div className="company-row-dot" />

                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`company-row-chevron${isOpen ? ' open' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {isOpen && group.map(i => <IncidentRow key={i.id} incident={i} />)}
                </div>
              );
            })
          )
          }
        </>
      )}
    </div>
  );
}
