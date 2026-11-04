import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  errorMessage, fetchIncidents, fetchNearby, fetchPlaces, planRoute, smartSearch,
} from '../api';
import type { NearbyIncident, NearbyResult, Place, PlaceCategory, RouteOption, SmartSearchResult } from '../api';
import { useGeolocation } from '../geolocation';
import type { GeoPoint } from '../geolocation';
import { useAddresses } from '../addresses';
import { firstName, useSession } from '../session';
import { NearMap } from '../components/NearMap';
import { PLACE_META, PLACE_ORDER, directionsUrl } from '../components/placeMeta';
import { Icon, TypeIcon } from '../components/Icon';
import { TYPE_OUTAGE, fmtDistance, fmtDuration, fmtWhen, incidentWhere, plural, typeStyle } from '../types';
import './near.css';

function greeting(): string {
  const h = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Sarajevo' }));
  return h < 11 ? 'Dobro jutro' : h < 18 ? 'Dobar dan' : 'Dobro veče';
}

// Ključ lokacije za ponovno učitavanje: ćelija ~10 m
const pointKey = (p: GeoPoint | null) => (p ? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}` : '');

function OutageRow({ i }: { i: NearbyIncident }) {
  const when = fmtWhen(i.starts_at, i.ends_at);
  return (
    <Link to={`/incidents/${i.id}`} className="near-row" style={typeStyle(i.type)}>
      <span className="near-row-icon"><TypeIcon type={i.type} size={18} /></span>
      <span className="near-row-body">
        <span className="near-row-title">
          {TYPE_OUTAGE[i.type]}
          {i.status === 'scheduled' && <span className="near-tag gold">Planirano</span>}
        </span>
        <span className="near-row-sub">{incidentWhere(i)}{when && ` · ${when}`}</span>
      </span>
      <span className="near-row-dist mono">{i.inside ? 'Ovdje' : fmtDistance(i.distance_meters ?? 0)}</span>
    </Link>
  );
}

function PlaceRow({ p, selected, onSelect, onRoute }: {
  p: Place; selected: boolean; onSelect: () => void; onRoute: () => void;
}) {
  const meta = PLACE_META[p.category];
  return (
    <li className={`place-row${selected ? ' on' : ''}`} style={{ '--pc': meta.color } as CSSProperties}>
      <button className="place-main" onClick={onSelect}>
        <span className="place-emoji" aria-hidden="true">{meta.emoji}</span>
        <span className="place-body">
          <span className="place-name">{p.name}</span>
          <span className="place-sub">
            {p.address ?? meta.label}
            {p.opening_hours === '24/7' && <span className="near-tag green">0–24</span>}
          </span>
          {p.outages.length > 0 && (
            <span className="place-warn"><Icon name="alert" size={13} /> {p.outages.map(t => TYPE_OUTAGE[t]).join(', ')} u zoni — možda ne radi</span>
          )}
        </span>
        <span className="place-dist mono">{fmtDistance(p.distance_m)}</span>
      </button>
      <div className="place-actions">
        <button className="btn secondary sm" onClick={onRoute}><Icon name="map" size={14} /> Ruta</button>
        <a className="btn secondary sm" href={directionsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer">
          <Icon name="external" size={14} /> Google Maps
        </a>
      </div>
    </li>
  );
}

function RoutePanel({ target, routes, loading, error, mode, onMode, onClose }: {
  target: { label: string };
  routes: RouteOption[];
  loading: boolean;
  error: string | null;
  mode: 'car' | 'foot';
  onMode: (m: 'car' | 'foot') => void;
  onClose: () => void;
}) {
  return (
    <section className="tile route-panel" aria-label="Ruta">
      <div className="route-head">
        <div>
          <div className="tile-label mono">Ruta</div>
          <div className="route-target">do {target.label}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Zatvori rutu"><Icon name="plus" size={16} className="rot45" /></button>
      </div>
      <div className="route-modes" role="group" aria-label="Način">
        <button aria-pressed={mode === 'car'} className={mode === 'car' ? 'on' : ''} onClick={() => onMode('car')}>🚗 Autom</button>
        <button aria-pressed={mode === 'foot'} className={mode === 'foot' ? 'on' : ''} onClick={() => onMode('foot')}>🚶 Pješke</button>
      </div>
      {loading ? <div className="near-skel" style={{ height: 64 }} />
        : error ? <p className="near-muted">{error}</p>
        : (
          <ol className="route-list">
            {routes.map((r, n) => (
              <li key={n} className={`route-opt${r.recommended ? ' best' : ''}${r.works.length ? ' works' : ''}`}>
                <span className="route-time mono">{fmtDuration(r.duration_s * 1000)}</span>
                <span className="route-meta">
                  {fmtDistance(r.distance_m)}
                  {r.recommended && <span className="near-tag green">Preporučeno</span>}
                </span>
                <span className="route-works">
                  {r.works.length === 0
                    ? <><Icon name="check" size={14} /> Bez radova na putu</>
                    : <><Icon name="alert" size={14} /> Prolazi kroz {r.works.length} {plural(r.works.length, 'zonu', 'zone', 'zona')} radova: {r.works.map(w => TYPE_OUTAGE[w.type]).join(', ')}</>}
                </span>
              </li>
            ))}
          </ol>
        )}
      {!loading && !error && routes.length > 0 && routes.every(r => r.works.length > 0) && (
        <p className="near-muted">Nijedna ruta ne zaobilazi radove u potpunosti — preporučena prolazi kroz najmanje zona.</p>
      )}
    </section>
  );
}

export default function Near() {
  const session = useSession();
  const geo = useGeolocation();
  const saved = useAddresses();
  const me = geo.point;
  const key = pointKey(me);

  const [nearby, setNearby]       = useState<NearbyResult | null>(null);
  const [nearbyErr, setNearbyErr] = useState(false);
  const [category, setCategory]   = useState<PlaceCategory>('atm');
  const [places, setPlaces]       = useState<Place[] | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [cityActive, setCityActive] = useState<number | null>(null);

  const [query, setQuery]         = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult]       = useState<SmartSearchResult | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [target, setTarget]       = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [mode, setMode]           = useState<'car' | 'foot'>('car');
  const [routes, setRoutes]       = useState<RouteOption[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeErr, setRouteErr]   = useState<string | null>(null);

  // Šta je oko mene: adresa i prekidi (osvježava se i svake 2 minute)
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    const load = () => fetchNearby(me.lat, me.lng)
      .then(r => { if (!cancelled) { setNearby(r); setNearbyErr(false); } })
      .catch(() => { if (!cancelled) setNearbyErr(true); });
    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key je zaokružen me
  }, [key]);

  // Objekti iz izabrane kategorije oko mene (rezultat pretrage ima prednost)
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    setPlaces(null);
    fetchPlaces(category, me.lat, me.lng)
      .then(r => { if (!cancelled) setPlaces(r); })
      .catch(() => { if (!cancelled) setPlaces([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, category]);

  useEffect(() => {
    fetchIncidents({ status: 'active', limit: 200 }).then(r => setCityActive(r.length)).catch(() => {});
  }, []);

  // Ruta od mene do cilja; ponovo kad se promijeni način ili lokacija
  useEffect(() => {
    if (!target || !me) { setRoutes([]); return; }
    let cancelled = false;
    setRouteBusy(true);
    setRouteErr(null);
    planRoute([me.lat, me.lng], [target.lat, target.lng], mode)
      .then(r => { if (!cancelled) setRoutes(r); })
      .catch(err => { if (!cancelled) { setRoutes([]); setRouteErr(errorMessage(err, 'Ruta trenutno nije dostupna.')); } })
      .finally(() => { if (!cancelled) setRouteBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, mode, key]);

  const search = async (e?: FormEvent, q = query) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    setSearchErr(null);
    try {
      const r = await smartSearch(q.trim(), me ? { lat: me.lat, lng: me.lng } : undefined);
      setResult(r);
      if (r.kind === 'places') setCategory(r.query.category);
    } catch (err) {
      setResult(null);
      setSearchErr(errorMessage(err, 'Pretraga trenutno ne radi.'));
    } finally {
      setSearching(false);
    }
  };

  const quick = (q: string) => { setQuery(q); search(undefined, q); };
  const clearSearch = () => { setResult(null); setQuery(''); setSearchErr(null); };

  const routeTo = useCallback((t: { label: string; lat: number; lng: number }) => {
    setTarget(t);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const inside = nearby?.incidents.filter(i => i.inside) ?? [];
  const around = nearby?.incidents.filter(i => !i.inside) ?? [];
  const shownPlaces = result?.kind === 'places' ? result.places : places ?? [];
  const onPlaceClick = useCallback((p: Place) => setSelected(p.id), []);
  const mapIncidents = useMemo(() => nearby?.incidents ?? [], [nearby]);

  const locLabel = me?.source === 'manual' ? me.label
    : nearby?.address?.label ?? (me ? 'Vaša lokacija' : null);

  return (
    <div className="page near-page">
      <div className="container">
        {/* ── Gdje sam ── */}
        <section className="near-hero">
          <div className="near-hello">
            <span className="near-greet">{greeting()}{session ? `, ${firstName(session.user)}` : ''}</span>
            <div className="near-loc">
              <span className={`near-loc-dot ${geo.status}`} />
              {me ? (
                <span className="near-loc-text">
                  <strong>{locLabel}</strong>
                  <small>{me.source === 'gps' ? `GPS${me.accuracy ? ` · ±${Math.round(me.accuracy)} m` : ''}` : 'Ručno izabrana lokacija'}</small>
                </span>
              ) : (
                <span className="near-loc-text">
                  <strong>{geo.status === 'asking' ? 'Tražimo vašu lokaciju…' : 'Lokacija nije dostupna'}</strong>
                  <small>{geo.status === 'denied' ? 'Dozvolite lokaciju u browseru ili upišite ulicu' : geo.status === 'asking' ? 'Dozvolite pristup lokaciji' : 'Upišite ulicu u pretragu'}</small>
                </span>
              )}
              {me?.source === 'manual' && geo.status === 'ok' && (
                <button className="btn secondary sm" onClick={() => geo.setManual(null)}><Icon name="pin" size={14} /> Moja lokacija</button>
              )}
              {!me && geo.status !== 'asking' && (
                <button className="btn secondary sm" onClick={geo.retry}><Icon name="refresh" size={14} /> Pokušaj</button>
              )}
            </div>
          </div>

          <form className="near-search" onSubmit={search} role="search">
            <Icon name="send" size={18} />
            <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Npr. bankomat kod Ferhadije, najbliža pumpa, ulica…" aria-label="Pretraga" />
            {(query || result) && <button type="button" className="near-search-x" onClick={clearSearch} aria-label="Očisti">×</button>}
            <button className="btn primary sm" disabled={searching}>{searching ? '…' : 'Traži'}</button>
          </form>
          <div className="near-quick">
            {['Najbliži bankomat', 'Najbliža pumpa', 'Pošta u blizini', 'Apoteka u blizini'].map(q => (
              <button key={q} className="chip-btn" onClick={() => quick(q)}>{q}</button>
            ))}
          </div>

          {!me && saved.length > 0 && (
            <div className="near-saved">
              <span className="near-muted">Vaše adrese:</span>
              {saved.map(a => (
                <button key={a.id} className="chip-btn" onClick={() => geo.setManual({ lat: a.lat, lng: a.lng, label: a.label })}>
                  <Icon name="home" size={14} /> {a.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {searchErr && <div className="near-alert neutral" role="alert"><Icon name="info" size={18} /> {searchErr}</div>}

        {result?.kind === 'address' && (
          <section className="tile near-results">
            <div className="tile-label mono">Adrese</div>
            {result.addresses.length === 0 ? <p className="near-muted">Nismo pronašli tu adresu u Kantonu Sarajevo.</p> : (
              <ul className="addr-results">
                {result.addresses.map(a => (
                  <li key={`${a.lat},${a.lng}`}>
                    <span><Icon name="pin" size={15} /> {a.label}</span>
                    <span className="addr-actions">
                      <button className="btn secondary sm" onClick={() => { geo.setManual(a); clearSearch(); }}>Prikaži okolinu</button>
                      {me && <button className="btn secondary sm" onClick={() => routeTo(a)}>Ruta</button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {target && (
          <RoutePanel target={target} routes={routes} loading={routeBusy} error={!me ? 'Za rutu treba vaša lokacija.' : routeErr}
            mode={mode} onMode={setMode} onClose={() => setTarget(null)} />
        )}

        <div className="near-grid">
          <div className="near-col">
            {/* ── U mojoj ulici ── */}
            {me && (
              !nearby && !nearbyErr ? <div className="near-skel" style={{ height: 120 }} />
              : nearbyErr ? (
                <div className="near-alert neutral"><Icon name="alert" size={18} /> Prekidi oko vas trenutno nisu dostupni.</div>
              ) : inside.length > 0 ? (
                <section className="near-status bad" aria-live="polite">
                  <div className="near-status-head">
                    <Icon name="alert" size={22} />
                    <div>
                      <strong>{inside.length === 1 ? TYPE_OUTAGE[inside[0].type] : `${inside.length} prekida`} na vašoj lokaciji</strong>
                      <span>Zona prekida pokriva mjesto gdje ste sada</span>
                    </div>
                  </div>
                  <div className="near-rows">{inside.map(i => <OutageRow key={i.id} i={i} />)}</div>
                </section>
              ) : (
                <section className="near-status ok" aria-live="polite">
                  <div className="near-status-head">
                    <Icon name="check" size={22} />
                    <div>
                      <strong>Kod vas sve radi</strong>
                      <span>{around.length > 0
                        ? `${around.length} ${plural(around.length, 'prekid', 'prekida', 'prekida')} u krugu od 1,5 km`
                        : 'Nema prekida u krugu od 1,5 km'}</span>
                    </div>
                  </div>
                </section>
              )
            )}

            {around.length > 0 && (
              <section className="tile near-block">
                <div className="near-block-head">
                  <h2>U blizini</h2>
                  <span className="near-muted">do 1,5 km</span>
                </div>
                <div className="near-rows">{around.slice(0, 6).map(i => <OutageRow key={i.id} i={i} />)}</div>
              </section>
            )}

            {/* ── Objekti ── */}
            <section className="tile near-block">
              <div className="near-block-head">
                <h2>{result?.kind === 'places' ? `${PLACE_META[result.query.category].plural} kod: ${result.center.label}` : 'Najbliže vama'}</h2>
                {result?.kind === 'places' && <button className="auth-link" onClick={clearSearch}>Oko mene</button>}
              </div>
              <div className="cat-tabs" role="tablist" aria-label="Vrsta objekta">
                {PLACE_ORDER.map(c => (
                  <button key={c} role="tab" aria-selected={category === c && result?.kind !== 'places'}
                    className={category === c && result?.kind !== 'places' ? 'on' : ''}
                    style={{ '--pc': PLACE_META[c].color } as CSSProperties}
                    onClick={() => { setResult(null); setCategory(c); }}>
                    <span aria-hidden="true">{PLACE_META[c].emoji}</span> {PLACE_META[c].label}
                  </button>
                ))}
              </div>
              {!me && result?.kind !== 'places' ? (
                <p className="near-muted">Uključite lokaciju ili potražite ulicu da vidite objekte u blizini.</p>
              ) : places === null && result?.kind !== 'places' ? (
                <div className="near-skel" style={{ height: 180 }} />
              ) : shownPlaces.length === 0 ? (
                <p className="near-muted">Nema objekata ove vrste u krugu od 2 km.</p>
              ) : (
                <ul className="place-list">
                  {shownPlaces.map(p => (
                    <PlaceRow key={p.id} p={p} selected={selected === p.id} onSelect={() => setSelected(p.id)}
                      onRoute={() => routeTo({ label: p.name, lat: p.lat, lng: p.lng })} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="near-col near-map-col">
            <div className="near-map-wrap">
              <NearMap me={me} incidents={mapIncidents} places={shownPlaces} routes={routes}
                selectedPlace={selected} onPlaceClick={onPlaceClick} />
            </div>
            <Link to="/prekidi" className="tile near-city">
              <span>
                <span className="tile-label mono">Kanton Sarajevo</span>
                <strong>{cityActive === null ? 'Svi prekidi' : `${cityActive} ${plural(cityActive, 'aktivan prekid', 'aktivna prekida', 'aktivnih prekida')}`}</strong>
              </span>
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
