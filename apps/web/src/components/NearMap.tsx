import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NearbyIncident, Place, RouteOption } from '../api';
import type { GeoPoint } from '../geolocation';
import { TYPE_COLOR, TYPE_OUTAGE, incidentWhere } from '../types';
import { PLACE_META } from './placeMeta';

// Mapa početne: ja, zone prekida oko mene, objekti i rute. Leaflet radi imperativno, pa se
// slojevi brišu i crtaju ponovo kad se promijene podaci.

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// CSS varijable (var(--water)) Leaflet ne razumije u SVG atributima — uzimamo izračunatu boju
function cssColor(value: string): string {
  const m = value.match(/^var\((--[\w-]+)\)$/);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#4F6BFF' : value;
}

export function NearMap({ me, incidents, places, routes, selectedPlace, onPlaceClick }: {
  me: GeoPoint | null;
  incidents: NearbyIncident[];
  places: Place[];
  routes: RouteOption[];
  selectedPlace?: string | null;
  onPlaceClick?: (p: Place) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([43.856, 18.413], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    layers.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layers.current;
    if (!m || !group) return;
    group.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    for (const i of incidents) {
      if (!i.area_geojson) continue;
      const color = cssColor(TYPE_COLOR[i.type]);
      L.geoJSON(i.area_geojson, {
        style: { color, fillColor: color, fillOpacity: i.inside ? 0.28 : 0.14, weight: i.inside ? 2.5 : 1.5, dashArray: i.status === 'scheduled' ? '6 6' : undefined },
      })
        .bindPopup(`<div class="popup-title">${esc(TYPE_OUTAGE[i.type])}</div><div class="popup-line">${esc(incidentWhere(i, 4))}</div>`, { className: 'si-popup' })
        .addTo(group);
    }

    routes.forEach(r => {
      const latlngs = r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      L.polyline(latlngs, {
        color: r.recommended ? cssColor('var(--green)') : r.works.length ? cssColor('var(--live)') : '#8A8FA0',
        weight: r.recommended ? 6 : 4,
        opacity: r.recommended ? 0.95 : 0.55,
        dashArray: r.recommended ? undefined : '2 8',
      }).addTo(group);
      bounds.push(...latlngs);
    });

    for (const p of places) {
      const meta = PLACE_META[p.category];
      const warn = p.outages.length > 0;
      const icon = L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<div class="place-pin${p.id === selectedPlace ? ' on' : ''}${warn ? ' warn' : ''}" style="--pc:${meta.color}">${meta.emoji}</div>`,
      });
      L.marker([p.lat, p.lng], { icon, title: p.name })
        .on('click', () => onPlaceClick?.(p))
        .addTo(group);
      if (!routes.length) bounds.push([p.lat, p.lng]);
    }

    if (me) {
      if (me.accuracy && me.accuracy < 400) {
        L.circle([me.lat, me.lng], { radius: me.accuracy, color: '#4F6BFF', weight: 1, fillOpacity: 0.08 }).addTo(group);
      }
      L.marker([me.lat, me.lng], {
        icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: '<div class="me-dot"></div>' }),
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(group);
      bounds.push([me.lat, me.lng]);
    }

    if (bounds.length > 1) m.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 16 });
    else if (me) m.setView([me.lat, me.lng], 15);
  }, [me, incidents, places, routes, selectedPlace, onPlaceClick]);

  return <div ref={el} className="near-map" />;
}
