import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchIncidents } from '../api';
import type { Incident, IncidentType } from '../types';
import { TYPE_ICON, TYPE_COLOR, TYPE_LABEL, COMPANIES, getCompany } from '../types';

declare const L: any;

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

function makeMarkerIcon(incident: Incident): any {
  const color = TYPE_COLOR[incident.type];
  const icon  = TYPE_ICON[incident.type];
  const isActive = incident.status === 'active';

  return L.divIcon({
    className: '',
    iconSize:  [40, 40],
    iconAnchor:[20, 40],
    popupAnchor:[0, -42],
    html: `
      <div style="
        width:40px;height:40px;border-radius:50% 50% 50% 0;
        background:${color};border:3px solid #fff;
        box-shadow:0 3px 10px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;
        font-size:18px;transform:rotate(-45deg);
        ${isActive ? `animation:pulse-${incident.type} 2s infinite;` : ''}
      ">
        <span style="transform:rotate(45deg)">${icon}</span>
      </div>
      ${isActive ? `<div style="
        position:absolute;top:-4px;right:-4px;width:12px;height:12px;
        background:#ED1D1D;border-radius:50%;border:2px solid #fff;
      "></div>` : ''}
    `,
  });
}

// Naslovi i adrese dolaze sa scrapovanih stranica — nikad ih ne ubacivati kao sirovi HTML
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function makePopup(incident: Incident): string {
  const color   = TYPE_COLOR[incident.type];
  const company = getCompany(incident.type);
  const addrs   = esc(incident.affected_addresses?.slice(0, 3).join(', ') ?? '');
  const time    = incident.starts_at
    ? new Date(incident.starts_at).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo' })
    : '';
  const endTime = incident.ends_at
    ? new Date(incident.ends_at).toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sarajevo' })
    : '';

  return `
    <div style="font-family:Quicksand,sans-serif;min-width:220px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:${color};color:#fff;font-size:9px;font-weight:800;
          letter-spacing:1px;padding:2px 8px;border-radius:4px">${TYPE_LABEL[incident.type].toUpperCase()}</span>
        ${incident.status === 'active'
          ? '<span style="background:#ED1D1D;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px">● AKTIVNO</span>'
          : '<span style="background:#F8B900;color:#fff;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px">PLANIRANO</span>'}
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:6px;line-height:1.3">${esc(incident.title)}</div>
      ${addrs ? `<div style="font-size:12px;color:#666;margin-bottom:6px">📍 ${addrs}</div>` : ''}
      ${time ? `<div style="font-size:12px;color:#666;margin-bottom:8px">🕐 ${time}${endTime ? ` – ${endTime}` : ''}</div>` : ''}
      <div style="display:flex;align-items:center;gap:6px;padding-top:8px;border-top:1px solid #f0f0f0">
        <img src="${company.logo}" style="width:20px;height:20px;object-fit:contain" onerror="this.style.display='none'"/>
        <span style="font-size:11px;color:#949AA9;font-weight:600">${company.shortName}</span>
      </div>
    </div>
  `;
}

export default function MapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected]   = useState<Incident | null>(null);
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef  = useRef<Map<string, any>>(new Map());
  const navigate    = useNavigate();

  const load = useCallback(async () => {
    // Dohvati i aktivan i planirane
    try {
      const [active, scheduled] = await Promise.all([
        fetchIncidents({ status: 'active',    limit: 100 }),
        fetchIncidents({ status: 'scheduled', limit: 100 }),
      ]);
      setIncidents([...active, ...scheduled]);
    } catch (err) {
      console.error('Učitavanje incidenata nije uspjelo', err);
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

    // Zoom kontrola dolje desno
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; markersRef.current.clear(); };
  }, []);

  // Ažuriraj markere kad se incidenti/filter promijeni
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Ukloni stare markere
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current.clear();

    const filtered = typeFilter === 'all' ? incidents : incidents.filter(i => i.type === typeFilter);
    const bounds: [number, number][] = [];

    filtered.forEach(incident => {
      const coords = getCoords(incident);
      if (!coords) return;

      bounds.push(coords);

      const marker = L.marker(coords, { icon: makeMarkerIcon(incident) })
        .bindPopup(makePopup(incident), { maxWidth: 280, className: 'komunalni-popup' })
        .on('click', () => setSelected(incident))
        .addTo(map);

      markersRef.current.set(incident.id, marker);
    });

    // Auto-zoom na sve markere
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [incidents, typeFilter]);

  // Panuj na marker kad se klikne iz liste
  const focusIncident = (incident: Incident) => {
    setSelected(incident);
    const coords = getCoords(incident);
    const marker = markersRef.current.get(incident.id);
    if (coords && mapInstance.current) {
      mapInstance.current.setView(coords, 15, { animate: true });
      marker?.openPopup();
    }
  };

  const filtered = typeFilter === 'all' ? incidents : incidents.filter(i => i.type === typeFilter);
  const activeCount    = incidents.filter(i => i.status === 'active').length;
  const scheduledCount = incidents.filter(i => i.status === 'scheduled').length;

  return (
    <div className="page" style={{ paddingBottom: 72 }}>
      {/* Header */}
      <div className="s-header" style={{ paddingBottom: 16 }}>
        <div>
          <div className="s-header-label">Servisne Informacije</div>
          <div className="s-header-title" style={{ fontSize: 20 }}>Mapa incidenata</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#ED1D1D', fontWeight: 700 }}>● {activeCount} aktivno</div>
          <div style={{ fontSize: 12, color: '#F8B900', fontWeight: 700, marginTop: 3 }}>◆ {scheduledCount} planirano</div>
        </div>
      </div>

      {/* Company type filters */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', background: 'var(--card)', borderBottom: '1px solid #F0F0F0' }}>
        <button onClick={() => setTypeFilter('all')} style={{
          flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: typeFilter === 'all' ? 'var(--primary)' : 'var(--card)',
          color: typeFilter === 'all' ? '#fff' : 'var(--text-sec)',
          border: `1.5px solid ${typeFilter === 'all' ? 'var(--primary)' : 'var(--border)'}`,
          cursor: 'pointer', fontFamily: 'Quicksand, sans-serif',
        }}>Sve ({incidents.length})</button>

        {COMPANIES.map(c => {
          const cnt = incidents.filter(i => i.type === c.type).length;
          if (cnt === 0) return null;
          const isActive = typeFilter === c.type;
          return (
            <button key={c.id} onClick={() => setTypeFilter(c.type)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px 4px 5px', borderRadius: 20,
              border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
              background: isActive ? 'var(--primary)' : 'var(--card)',
              cursor: 'pointer', fontFamily: 'Quicksand, sans-serif',
            }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: isActive ? 'rgba(255,255,255,0.2)' : c.logoBg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={c.logo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#fff' : 'var(--text)' }}>
                {c.shortName} ({cnt})
              </span>
            </button>
          );
        })}
      </div>

      {/* Mapa */}
      <div ref={mapRef} style={{ width: '100%', height: 420 }} />

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 16px', background: 'var(--card)', borderTop: '1px solid #F0F0F0', borderBottom: '1px solid #F0F0F0', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#949AA9', fontWeight: 600, whiteSpace: 'nowrap' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ED1D1D' }} /> Aktivno sada
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#949AA9', fontWeight: 600, whiteSpace: 'nowrap' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F8B900' }} /> Planirano
        </div>
        {(Object.keys(TYPE_ICON) as IncidentType[]).map(type => (
          incidents.some(i => i.type === type) ? (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#949AA9', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_COLOR[type] }} />
              {TYPE_ICON[type]} {getCompany(type).shortName}
            </div>
          ) : null
        ))}
      </div>

      {/* Lista incidenata */}
      <div style={{ padding: '12px 16px 4px' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#949AA9', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {filtered.length} incidenta na mapi — klikni za detalje
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty" style={{ paddingTop: 32 }}>
          <div className="empty-icon">🗺️</div>
          <div className="empty-title">Nema incidenata</div>
          <div className="empty-sub">Nema aktivnih ni planiranih poremećaja za prikaz na mapi.</div>
        </div>
      ) : (
        filtered.map(incident => {
          const color   = TYPE_COLOR[incident.type];
          const company = getCompany(incident.type);
          const isSelected = selected?.id === incident.id;

          return (
            <div key={incident.id}
              onClick={() => focusIncident(incident)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                background: isSelected ? `${color}18` : 'var(--card)',
                borderBottom: '1px solid var(--border)',
                borderLeft: `4px solid ${isSelected ? color : 'transparent'}`,
                cursor: 'pointer', transition: 'all .15s',
              }}>
              {/* Logo */}
              <div style={{ width: 40, height: 40, borderRadius: 10, background: company.logoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={company.logo} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, background: color, color: '#fff', padding: '2px 6px', borderRadius: 4, letterSpacing: 1 }}>
                    {TYPE_ICON[incident.type]} {company.shortName}
                  </span>
                  {incident.status === 'active'
                    ? <span style={{ fontSize: 9, fontWeight: 800, color: '#ED1D1D' }}>● AKTIVNO</span>
                    : <span style={{ fontSize: 9, fontWeight: 800, color: '#F8B900' }}>◆ PLANIRANO</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {incident.title}
                </div>
                {incident.affected_addresses?.length ? (
                  <div style={{ fontSize: 11, color: '#949AA9', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📍 {incident.affected_addresses.slice(0, 2).join(', ')}
                  </div>
                ) : null}
              </div>

              <button onClick={e => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: color, background: `${color}15`,
                  border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Quicksand, sans-serif' }}>
                Detalji
              </button>
            </div>
          );
        })
      )}

      <style>{`
        .komunalni-popup .leaflet-popup-content-wrapper {
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          border: none;
          padding: 0;
        }
        .komunalni-popup .leaflet-popup-content { margin: 16px; }
        .komunalni-popup .leaflet-popup-tip { background: #fff; }
      `}</style>
    </div>
  );
}
