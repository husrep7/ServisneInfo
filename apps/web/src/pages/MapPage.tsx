import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchIncidents, fetchPublicReports } from '../api';
import type { PublicReport } from '../api';
import type { Incident, IncidentType } from '../types';
import { TYPE_COLOR, TYPE_LABEL, TYPE_SERVICE, COMPANIES, getCompany, fmtWhen, typeStyle, reportExpiresIn, timeAgo } from '../types';
import { ReportCard } from '../components/ReportCard';
import { isNearMe, useAddresses } from '../addresses';
import type { SavedAddress } from '../addresses';
import { typeIconSvg } from '../icons';
import { PageHeader } from '../components/PageHeader';
import { IncidentCard } from '../components/IncidentCard';
import { Icon, TypeIcon } from '../components/Icon';
import { EmptyState, LoadError } from '../components/States';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Centroidi sarajevskih općina — fallback za incidente bez koordinata
const OPCINA_COORDS: Record<string, [number, number]> = {
  'centar':         [43.8580, 18.4130],
  'stari grad':     [43.8600, 18.4340],
  'novi grad':      [43.8450, 18.3700],
  'novo sarajevo':  [43.8470, 18.3970],
  'ilidža':         [43.8300, 18.3100],
  'vogošća':        [43.9020, 18.3440],
  'hadžići':        [43.8220, 18.1980],
  'trnovo':         [43.7120, 18.3490],
  'ilijaš':         [43.9620, 18.2700],
  'sarajevo':       [43.8563, 18.4131],
};

function getCoords(incident: Incident): [number, number] | null {
  if (incident.area_geojson) {
    // Centroid polygona
    const coords = incident.area_geojson.coordinates[0];
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    return [lat, lng];
  }
  // Pokušaj iz naslova izvući općinu
  const title = incident.title.toLowerCase();
  for (const [opcina, coords] of Object.entries(OPCINA_COORDS)) {
    if (title.includes(opcina)) return coords;
  }
  // Fallback: municipality polje
  const mun = incident.municipality?.toLowerCase() ?? '';
  for (const [opcina, coords] of Object.entries(OPCINA_COORDS)) {
    if (mun.includes(opcina)) return coords;
  }
  return null;
}

function makeMarkerIcon(incident: Incident): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize:   [38, 38],
    iconAnchor: [19, 38],
    popupAnchor:[0, -40],
    html: `
      <div class="marker-pin" style="background:${TYPE_COLOR[incident.type]}">
        <span>${typeIconSvg(incident.type, 17, '#fff')}</span>
      </div>
      ${incident.status === 'active' ? '<div class="marker-live"></div>' : ''}
    `,
  });
}

// Naslovi i adrese dolaze sa scrapovanih stranica — nikad ih ne ubacivati kao sirovi HTML
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function makePopup(incident: Incident): string {
  const addrs = esc(incident.affected_addresses?.slice(0, 3).join(', ') ?? '');
  const when  = fmtWhen(incident.starts_at, incident.ends_at);
  const badge = incident.status === 'active'
    ? '<span class="badge live">Aktivno</span>'
    : '<span class="badge scheduled">Planirano</span>';

  return `
    <div class="popup-badges">${badge}</div>
    <div class="popup-title">${esc(incident.title)}</div>
    ${addrs ? `<div class="popup-line">📍 ${addrs}</div>` : ''}
    ${when ? `<div class="popup-line">🕐 ${esc(when)}</div>` : ''}
    <div class="popup-company">${esc(getCompany(incident.type).shortName)} · ${esc(TYPE_LABEL[incident.type])}</div>
  `;
}

// Nepotvrđena prijava je tačka, ne zona (KTD12); sav tekst prijave ide kroz esc()
function makeReportIcon(report: PublicReport): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
    html: `<div class="marker-report" style="background:${TYPE_COLOR[report.type]}"></div>`,
  });
}

function makeReportPopup(report: PublicReport): string {
  return `
    <div class="popup-badges"><span class="badge unconfirmed">Nepotvrđeno</span></div>
    <div class="popup-title">${esc(report.title)}</div>
    ${report.description ? `<div class="popup-line">${esc(report.description)}</div>` : ''}
    <div class="popup-line">📍 ${esc(report.address)}</div>
    <div class="popup-line">🕐 Prijavljeno ${esc(timeAgo(report.created_at))}</div>
    <div class="popup-company">${esc(TYPE_SERVICE[report.type])} · prijava građana · čeka potvrdu, ${esc(reportExpiresIn(report.created_at))}</div>
  `;
}

const homeIcon = L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="marker-home"></div>' });

function makeHomePopup(a: SavedAddress): string {
  return `<div class="popup-title">${esc(a.label)}</div>${a.label !== a.text ? `<div class="popup-line">${esc(a.text)}</div>` : ''}`;
}

export default function MapPage() {
  const [incidents, setIncidents]   = useState<Incident[]>([]);
  const [failed, setFailed]         = useState(false);
  const [selected, setSelected]     = useState<Incident | null>(null);
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const [nearOnly, setNearOnly]     = useState(false);
  const [reports, setReports]       = useState<PublicReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const addresses = useAddresses();
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef  = useRef<Map<string, L.Marker>>(new Map());
  const navigate    = useNavigate();

  const load = useCallback(async () => {
    try {
      const [active, scheduled] = await Promise.all([
        fetchIncidents({ status: 'active',    limit: 100 }),
        fetchIncidents({ status: 'scheduled', limit: 100 }),
      ]);
      setIncidents([...active, ...scheduled]);
      setFailed(false);
      fetchPublicReports().then(setReports).catch(() => setReports([]));
    } catch (err) {
      console.error('Učitavanje incidenata nije uspjelo', err);
      setFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Init mapa jednom
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([43.856, 18.413], 12);

    // OpenStreetMap — besplatan, bez API ključa
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstance.current = map;
    // Leaflet ne prati promjenu veličine kontejnera (fontovi, sticky layout) — preračunaj sam
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapRef.current);
    const markers = markersRef.current;
    return () => { ro.disconnect(); map.remove(); mapInstance.current = null; markers.clear(); };
  }, []);

  // Ažuriraj markere kad se incidenti/filter promijene
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current.clear();

    const filtered = incidents
      .filter(i => typeFilter === 'all' || i.type === typeFilter)
      .filter(i => !nearOnly || isNearMe(i, addresses));
    const bounds: [number, number][] = [];

    filtered.forEach(incident => {
      const coords = getCoords(incident);
      if (!coords) return;
      bounds.push(coords);

      const marker = L.marker(coords, { icon: makeMarkerIcon(incident) })
        .bindPopup(makePopup(incident), { maxWidth: 280, className: 'si-popup' })
        .on('click', () => setSelected(incident))
        .addTo(map);
      markersRef.current.set(incident.id, marker);
    });

    // Filter po tipu važi i za prijave (U8 korak 3); "Kod mene" se odnosi na prekide
    reports
      .filter(r => r.lat != null && r.lng != null && (typeFilter === 'all' || r.type === typeFilter))
      .filter(() => !nearOnly)
      .forEach(report => {
        const coords: [number, number] = [report.lat!, report.lng!];
        bounds.push(coords);
        const marker = L.marker(coords, { icon: makeReportIcon(report) })
          .bindPopup(makeReportPopup(report), { maxWidth: 280, className: 'si-popup' })
          .on('click', () => setSelectedReport(report.id))
          .addTo(map);
        markersRef.current.set(`r:${report.id}`, marker);
      });

    addresses.forEach(a => {
      const marker = L.marker([a.lat, a.lng], { icon: homeIcon, keyboard: false })
        .bindPopup(makeHomePopup(a), { className: 'si-popup' })
        .addTo(map);
      markersRef.current.set(`a:${a.id}`, marker);
      if (nearOnly) bounds.push([a.lat, a.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [incidents, reports, addresses, typeFilter, nearOnly]);

  const focusReport = (report: PublicReport) => {
    setSelectedReport(report.id);
    if (report.lat != null && report.lng != null && mapInstance.current) {
      mapInstance.current.setView([report.lat, report.lng], 16, { animate: true });
      markersRef.current.get(`r:${report.id}`)?.openPopup();
    }
  };

  // Fokus na marker kad se klikne iz liste
  const focusIncident = (incident: Incident) => {
    setSelected(incident);
    const coords = getCoords(incident);
    if (coords && mapInstance.current) {
      mapInstance.current.setView(coords, 15, { animate: true });
      markersRef.current.get(incident.id)?.openPopup();
    }
  };

  const filtered       = incidents
    .filter(i => typeFilter === 'all' || i.type === typeFilter)
    .filter(i => !nearOnly || isNearMe(i, addresses));
  const shownReports   = nearOnly ? [] : reports.filter(r => typeFilter === 'all' || r.type === typeFilter);
  const nearCount      = incidents.filter(i => isNearMe(i, addresses)).length;
  const activeCount    = incidents.filter(i => i.status === 'active').length;
  const scheduledCount = incidents.filter(i => i.status === 'scheduled').length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="ServisneInfo"
        title="Mapa prekida"
        aside={
          <div className="stat-inline">
            <span className="stat-pill live"><span className="dot" /> {activeCount} aktivno</span>
            <span className="stat-pill gold"><span className="dot" /> {scheduledCount} planirano</span>
          </div>
        }
      />

      <div className="container">
        <div className="filter-bar" role="group" aria-label="Filter po preduzeću">
          <button onClick={() => setNearOnly(n => !n)} aria-pressed={nearOnly}
            className={`chip-btn${nearOnly ? ' active' : ''}`}>
            <Icon name="pin" size={16} /> Kod mene {addresses.length > 0 && <span className="chip-count">{nearCount}</span>}
          </button>
          <button onClick={() => setTypeFilter('all')} aria-pressed={typeFilter === 'all'}
            className={`chip-btn${typeFilter === 'all' ? ' active' : ''}`}>
            Sve <span className="chip-count">{incidents.length}</span>
          </button>
          {COMPANIES.map(c => {
            const cnt = incidents.filter(i => i.type === c.type).length;
            if (cnt === 0) return null;
            const isOn = typeFilter === c.type;
            return (
              <button key={c.id} onClick={() => setTypeFilter(c.type)} aria-pressed={isOn}
                className={`chip-btn${isOn ? ' active' : ''}`} style={typeStyle(c.type)}>
                <TypeIcon type={c.type} size={16} /> {c.shortName} <span className="chip-count">{cnt}</span>
              </button>
            );
          })}
        </div>

        <div className="map-layout">
          <div ref={mapRef} className="map-canvas" />

          <div className="map-side">
            <div className="legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--live)' }} /> Aktivno sada</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--gold)' }} /> Planirano</span>
              {(Object.keys(TYPE_COLOR) as IncidentType[]).map(type => (
                incidents.some(i => i.type === type) ? (
                  <span key={type} className="legend-item">
                    <span className="legend-dot" style={{ background: TYPE_COLOR[type] }} /> {getCompany(type).shortName}
                  </span>
                ) : null
              ))}
            </div>

            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 className="section-title">
                {filtered.length} {filtered.length === 1 ? 'prekid' : 'prekida'} na mapi
              </h2>
              <span className="section-meta">Klikni za lokaciju</span>
            </div>

            {failed && incidents.length === 0 ? <LoadError onRetry={load} />
              : nearOnly && addresses.length === 0 ? (
                <EmptyState icon="pin" tone="neutral" title="Dodajte adresu da vidite prekide kod sebe"
                  action={<Link to="/settings" className="btn primary">Otvori postavke</Link>}>
                  Adrese se čuvaju samo u ovom browseru.
                </EmptyState>
              )
              : nearOnly && filtered.length === 0 ? (
                <EmptyState title="Trenutno nema prekida na vašim adresama">
                  Nijedna zona prekida ne pokriva vaše sačuvane adrese.
                </EmptyState>
              )
              : filtered.length === 0 && shownReports.length === 0 ? (
                <EmptyState icon="map" tone="neutral" title="Nema prekida za prikaz">
                  Nema aktivnih ni planiranih prekida na mapi.
                </EmptyState>
              ) : (
                <div className="map-list">
                  {filtered.map((incident, n) => (
                    <IncidentCard key={incident.id} incident={incident} index={n}
                      selected={selected?.id === incident.id}
                      onClick={() => focusIncident(incident)}
                      action={
                        <button className="details-btn"
                          onClick={e => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}>
                          Detalji <Icon name="arrow" size={13} />
                        </button>
                      } />
                  ))}
                  {shownReports.length > 0 && (
                    <h3 className="section-title" style={{ marginTop: 12, fontSize: 15 }}>Nepotvrđene prijave</h3>
                  )}
                  {shownReports.map(r => (
                    <ReportCard key={r.id} report={r} selected={selectedReport === r.id} onFocus={() => focusReport(r)} />
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
