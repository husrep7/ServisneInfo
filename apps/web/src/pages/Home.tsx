import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { fetchIncidents, fetchPublicReports, connectWS } from '../api';
import type { PublicReport } from '../api';
import { IncidentCard } from '../components/IncidentCard';
import { ReportCard } from '../components/ReportCard';
import { isNearMe, useAddresses } from '../addresses';
import { BrandMark, Icon, TypeIcon } from '../components/Icon';
import { EmptyState, LoadError, SkeletonList } from '../components/States';
import type { Incident, IncidentType } from '../types';
import { COMPANIES, TYPE_SERVICE, plural, typeStyle } from '../types';

const DANI    = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const MJESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const SERVICE_ORDER: IncidentType[] = ['water', 'electricity', 'gas', 'heating', 'internet'];

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

type StatusFilter = 'all' | 'active' | 'scheduled' | 'near';

export default function Home() {
  const [all, setAll]                   = useState<Incident[]>([]);
  const [reports, setReports]           = useState<PublicReport[]>([]);
  const addresses = useAddresses();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading]           = useState(true);
  const [failed, setFailed]             = useState(false);
  // Grupe po preduzeću su zatvorene po defaultu
  const [open, setOpen]                 = useState<Set<string>>(new Set());
  const now = useClock();

  const toggleGroup = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const load = useCallback(async () => {
    try {
      const [active, scheduled] = await Promise.all([
        fetchIncidents({ status: 'active',    limit: 100 }),
        fetchIncidents({ status: 'scheduled', limit: 100 }),
      ]);
      const data = [...active, ...scheduled];
      // Najnovije objave prve (created_at = kada je scraper pronašao obavijest)
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAll(data);
      setFailed(false);
      // Prijave su dodatak — ako ne uspiju, lista prekida i dalje radi
      fetchPublicReports().then(setReports).catch(() => setReports([]));
    } catch (err) {
      console.error('Učitavanje incidenata nije uspjelo', err);
      setFailed(true);
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

  const retry = () => { setLoading(true); load(); };

  const active    = all.filter(i => i.status === 'active');
  const scheduled = all.filter(i => i.status === 'scheduled');
  // "Kod mene": prekidi čija zona pokriva neku sačuvanu adresu (R4), računa se u browseru
  const nearMe    = all.filter(i => isNearMe(i, addresses));
  // Default: posljednjih 5 aktivnih; filter Aktivno/Planirano: sve iz te kategorije
  const displayed = statusFilter === 'all' ? active.slice(0, 5)
    : statusFilter === 'active' ? active
    : statusFilter === 'near' ? nearMe : scheduled;

  const headline = loading ? 'Učitavanje…'
    : failed ? 'Podaci trenutno nisu dostupni'
    : active.length === 0 ? 'Trenutno nema prekida'
    : `${active.length} ${plural(active.length, 'aktivan prekid', 'aktivna prekida', 'aktivnih prekida')}`;
  const subline = loading || failed ? '' : scheduled.length > 0
    ? `i ${scheduled.length} ${plural(scheduled.length, 'planiran', 'planirana', 'planiranih')} u narednom periodu`
    : 'Nema najavljenih radova';

  const filterPill = (status: Exclude<StatusFilter, 'all'>, label: string, count: number | null, color: string) => {
    const isOn = statusFilter === status;
    return (
      <button className={`filter-pill${isOn ? ' active' : ''}`} aria-pressed={isOn}
        onClick={() => setStatusFilter(isOn ? 'all' : status)}
        style={{ '--pill-color': color } as CSSProperties}>
        {label} {count !== null && <span className="count">{count}</span>}
      </button>
    );
  };

  return (
    <div className="page">
      <section className="hero">
        <div className="container">
          <div className="hero-top">
            <div className="hero-brand">
              <BrandMark size={34} />
              <div>
                <div className="hero-brand-name">ServisneInfo</div>
                <div className="hero-brand-city">Kanton Sarajevo</div>
              </div>
            </div>
            <div className="hero-clock">
              <div className="hero-time">
                {now.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Sarajevo' })}
              </div>
              <div className="hero-date">{formatSarajevoDate(now)}</div>
            </div>
          </div>

          <h1 className="hero-headline hero-live">
            {!loading && !failed && <span className={`pulse-dot${active.length === 0 ? ' ok' : ''}`} />}
            {headline}
          </h1>
          {subline && <p className="hero-sub">{subline}</p>}

          {!loading && !failed && (
            <div className="hero-filters">
              {filterPill('active',    'Aktivno',   active.length,    'var(--live)')}
              {filterPill('scheduled', 'Planirano', scheduled.length, 'var(--gold)')}
              {filterPill('near',      'Kod mene',  addresses.length ? nearMe.length : null, 'var(--primary)')}
            </div>
          )}
        </div>
      </section>

      <div className="container home-layout">
        <aside className="home-aside section">
          <div className="section-head"><h2 className="section-title">Stanje usluga</h2></div>
          <div className="services">
            {SERVICE_ORDER.map(type => {
              const a = active.filter(i => i.type === type).length;
              const s = scheduled.filter(i => i.type === type).length;
              const [cls, text] = loading || failed ? ['unknown', '—']
                : a > 0 ? ['live', `${a} ${plural(a, 'prekid', 'prekida', 'prekida')}`]
                : s > 0 ? ['planned', `${s} ${plural(s, 'planiran', 'planirana', 'planiranih')}`]
                : ['ok', 'Bez prekida'];
              return (
                <div key={type} className="service" style={typeStyle(type)}>
                  <div className="service-icon"><TypeIcon type={type} size={20} /></div>
                  <div className="service-body">
                    <div className="service-name">{TYPE_SERVICE[type]}</div>
                    <div className={`service-status ${cls}`}>{text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="section">
          <div className="section-head">
            <h2 className="section-title">
              {statusFilter === 'active' ? 'Aktivni prekidi'
                : statusFilter === 'scheduled' ? 'Planirani prekidi'
                : statusFilter === 'near' ? 'Prekidi na mojim adresama'
                : 'Posljednje obavijesti'}
            </h2>
            {statusFilter !== 'all' && (
              <button className="section-meta" onClick={() => setStatusFilter('all')}>Prikaži sve</button>
            )}
          </div>

          {loading ? <SkeletonList />
            : failed ? <LoadError onRetry={retry} />
            : statusFilter === 'near' && addresses.length === 0 ? (
              <EmptyState icon="pin" tone="neutral" title="Dodajte adresu da vidite prekide kod sebe"
                action={<Link to="/settings" className="btn primary">Otvori postavke</Link>}>
                Adrese se čuvaju samo u ovom browseru.
              </EmptyState>
            )
            : statusFilter === 'near' && displayed.length === 0 ? (
              <EmptyState title="Trenutno nema prekida na vašim adresama">
                Pratimo {addresses.length} {plural(addresses.length, 'adresu', 'adrese', 'adresa')}.
              </EmptyState>
            )
            : displayed.length === 0 ? (
              <EmptyState title={statusFilter === 'scheduled' ? 'Nema planiranih radova' : 'Sve radi normalno'}>
                {statusFilter === 'scheduled'
                  ? 'Komunalna preduzeća nisu najavila radove.'
                  : 'Nema prijavljenih prekida komunalnih usluga u Sarajevu.'}
              </EmptyState>
            ) : statusFilter === 'all' || statusFilter === 'near' ? (
              <div className="stack">{displayed.map(i => <IncidentCard key={i.id} incident={i} />)}</div>
            ) : (
              // Aktivno/Planirano: grupisano po preduzeću
              <div className="stack">
                {COMPANIES.map(c => {
                  const group = displayed.filter(i => i.type === c.type);
                  if (group.length === 0) return null;
                  const isOpen = open.has(c.id);
                  const a = group.filter(i => i.status === 'active').length;
                  const s = group.length - a;
                  return (
                    <div key={c.id} className="group" style={typeStyle(c.type)}>
                      <button className="group-head" onClick={() => toggleGroup(c.id)} aria-expanded={isOpen}>
                        <div className="inc-card-icon"><TypeIcon type={c.type} size={22} /></div>
                        <div>
                          <div className="group-name">{c.shortName}</div>
                          <div className="group-counts">
                            {a > 0 && <span style={{ color: 'var(--live-text)' }}>{a} aktivno</span>}
                            {s > 0 && <span style={{ color: 'var(--gold-text)' }}>{s} planirano</span>}
                          </div>
                        </div>
                        <Icon name="down" size={18} className={`group-chevron${isOpen ? ' open' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="group-items">
                          {group.map(i => <IncidentCard key={i.id} incident={i} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          {!loading && !failed && reports.length > 0 && statusFilter !== 'scheduled' && (
            <section className="section" aria-labelledby="reports-title" style={{ marginTop: 28 }}>
              <div className="section-head">
                <h2 className="section-title" id="reports-title">Nepotvrđene prijave građana</h2>
                <span className="section-meta">{reports.length}</span>
              </div>
              <div className="stack">{reports.map(r => <ReportCard key={r.id} report={r} />)}</div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
