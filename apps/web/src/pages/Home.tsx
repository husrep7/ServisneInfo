import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { fetchIncidents, fetchPublicReports, connectWS } from '../api';
import type { PublicReport } from '../api';
import { IncidentCard } from '../components/IncidentCard';
import { ReportCard } from '../components/ReportCard';
import { isNearMe, useAddresses } from '../addresses';
import { Icon, TypeIcon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { EmptyState, LoadError, SkeletonList } from '../components/States';
import { useNow } from '../hooks';
import type { Incident, IncidentType } from '../types';
import { COMPANIES, TYPE_SERVICE, dayLabel, fmtTime, getCompany, plural, typeStyle } from '../types';

const DANI    = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const MJESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const SERVICE_ORDER: IncidentType[] = ['water', 'electricity', 'gas', 'heating', 'internet'];

function formatSarajevoDate(date: Date): string {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Sarajevo' }));
  return `${DANI[d.getDay()]}, ${d.getDate()}. ${MJESECI[d.getMonth()]}`;
}

// Zaseban sat da se lista ne renderuje svake sekunde
function BoardClock() {
  const now  = new Date(useNow(1000));
  const time = now.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Sarajevo' });
  return (
    <div className="tile clock-tile">
      <span className="clock-time mono">{time.slice(0, 5)}<span className="sec">{time.slice(5)}</span></span>
      <span className="clock-date">{formatSarajevoDate(now)}</span>
    </div>
  );
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
  // Vremenska linija: planirani radovi po vremenu početka
  const upcoming = scheduled
    .filter(i => i.starts_at)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())
    .slice(0, 4);

  const ready = !loading && !failed;
  const subline = !ready ? '' : scheduled.length > 0
    ? `i ${scheduled.length} ${plural(scheduled.length, 'planiran', 'planirana', 'planiranih')} u narednom periodu`
    : 'Nema najavljenih radova';

  return (
    <div className="page">
      <div className="container">
        <section className="bento">
          <div className="tile hero-tile">
            <span className={`live-label mono${ready && active.length === 0 ? ' ok' : ''}`}>Uživo · Kanton Sarajevo</span>
            <div>
              {ready && active.length > 0 && <div className="hero-count" key={active.length}>{active.length}</div>}
              <h1 className="hero-title">
                {loading ? 'Učitavanje…'
                  : failed ? 'Podaci trenutno nisu dostupni'
                  : active.length === 0 ? 'Trenutno nema prekida'
                  : `${plural(active.length, 'aktivan prekid', 'aktivna prekida', 'aktivnih prekida')} upravo sada`}
              </h1>
              {subline && <p className="hero-sub">{subline}</p>}
            </div>
          </div>

          <BoardClock />

          {/* Pregled po usluzi — samo prikaz, nije klikabilno */}
          <ul className="tile svc-tile" aria-label="Stanje usluga">
            {SERVICE_ORDER.map(type => {
              const a = active.filter(i => i.type === type).length;
              const s = scheduled.filter(i => i.type === type).length;
              const [cls, text] = !ready ? ['unknown', '—']
                : a > 0 ? ['live', `${a} ${plural(a, 'prekid', 'prekida', 'prekida')}`]
                : s > 0 ? ['planned', `${s} ${plural(s, 'planiran', 'planirana', 'planiranih')}`]
                : ['ok', 'Radi'];
              return (
                <li key={type} className={`svc ${cls}`} style={typeStyle(type)}>
                  <span className="svc-dot" />
                  <span className="svc-name"><TypeIcon type={type} size={15} /> {TYPE_SERVICE[type]}</span>
                  <span className="svc-status mono">{text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="section">
          <div className="list-head">
            <h2 className="section-title">
              {statusFilter === 'active' ? 'Aktivni prekidi'
                : statusFilter === 'scheduled' ? 'Planirani prekidi'
                : statusFilter === 'near' ? 'Prekidi na mojim adresama'
                : 'Upravo sada'}
            </h2>
            {ready && (
              <Segmented label="Filter obavijesti" value={statusFilter} onChange={setStatusFilter}
                options={[
                  { value: 'all',       label: 'Najnovije' },
                  { value: 'active',    label: 'Aktivno',   count: active.length },
                  { value: 'scheduled', label: 'Planirano', count: scheduled.length },
                  { value: 'near',      label: 'Kod mene',  count: addresses.length ? nearMe.length : undefined },
                ]} />
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
              <div className="tile">
                <EmptyState title={statusFilter === 'scheduled' ? 'Nema planiranih radova' : 'Sve radi normalno'}>
                  {statusFilter === 'scheduled'
                    ? 'Komunalna preduzeća nisu najavila radove.'
                    : 'Nema prijavljenih prekida komunalnih usluga u Sarajevu.'}
                </EmptyState>
              </div>
            ) : statusFilter === 'all' || statusFilter === 'near' ? (
              <div className="card-grid" key={statusFilter}>{displayed.map((i, n) => <IncidentCard key={i.id} incident={i} index={n} />)}</div>
            ) : (
              // Aktivno/Planirano: grupisano po preduzeću
              <div className="stack" key={statusFilter}>
                {COMPANIES.map((c, n) => {
                  const group = displayed.filter(i => i.type === c.type);
                  if (group.length === 0) return null;
                  const isOpen = open.has(c.id);
                  const a = group.filter(i => i.status === 'active').length;
                  const s = group.length - a;
                  return (
                    <div key={c.id} className={`group reveal${isOpen ? ' open' : ''}`}
                      style={{ ...typeStyle(c.type), '--d': `${n * 50}ms` } as CSSProperties}>
                      <button className="group-head" onClick={() => toggleGroup(c.id)} aria-expanded={isOpen}>
                        <div className="inc-card-icon"><TypeIcon type={c.type} size={22} /></div>
                        <div>
                          <div className="group-name">{c.shortName}</div>
                          <div className="group-counts mono">
                            {a > 0 && <span className="t-live">{a} aktivno</span>}
                            {s > 0 && <span className="t-gold">{s} planirano</span>}
                          </div>
                        </div>
                        <span className="group-count mono">{group.length}</span>
                        <Icon name="down" size={18} className="group-chevron" />
                      </button>
                      {isOpen && (
                        <div className="group-items card-grid">
                          {group.map((i, k) => <IncidentCard key={i.id} incident={i} index={k} />)}
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
              <div className="card-grid">{reports.map(r => <ReportCard key={r.id} report={r} />)}</div>
            </section>
          )}
        </section>

        <section className="bento bento-bottom section">
          {ready && upcoming.length > 0 && (
            <div className="tile soon-tile">
              <div className="tile-label mono">Uskoro</div>
              <ol className="soon">
                {upcoming.map(i => (
                  <li key={i.id} style={typeStyle(i.type)}>
                    <Link to={`/incidents/${i.id}`} className="soon-item">
                      <span className="soon-when mono">{dayLabel(i.starts_at!)} {fmtTime(i.starts_at)}</span>
                      <span className="soon-title">{i.title}</span>
                      <span className="soon-company"><TypeIcon type={i.type} size={13} /> {getCompany(i.type).shortName}</span>
                      <Icon name="arrow" size={16} className="soon-arrow" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="tile cta-tile">
            <div className="tile-label mono">Prijava</div>
            <div>
              <div className="cta-title">Nešto ne radi kod vas?</div>
              <p>Prijavite prekid koji još nije objavljen. Prikazaćemo je odmah kao nepotvrđenu prijavu.</p>
              <Link to="/report" className="btn accent">
                <Icon name="plus" size={16} strokeWidth={2.6} /> Prijavi problem <Icon name="arrow" size={16} className="btn-arrow" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
