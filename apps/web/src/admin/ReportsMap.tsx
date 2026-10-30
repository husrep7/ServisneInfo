import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AdminReport } from './api';
import { TYPE_COLOR } from '../types';
import { esc, fmtDateTime } from './format';

// Mapa prijava sa tačkom; klik na marker bira prijavu u listi
export default function ReportsMap({ reports, selectedId, onSelect }: {
  reports: AdminReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView([43.856, 18.413], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group || !map.current) return;
    group.clearLayers();
    markers.current.clear();
    const points: L.LatLngExpression[] = [];
    for (const r of reports) {
      if (r.lat == null || r.lng == null) continue;
      const m = L.circleMarker([r.lat, r.lng], {
        radius: 8, color: '#fff', weight: 2, fillColor: TYPE_COLOR[r.type], fillOpacity: 0.9,
      })
        .bindPopup(`<strong>${esc(r.title)}</strong><br>${esc(r.address)}<br><small>${esc(fmtDateTime(r.created_at))}</small>`)
        .on('click', () => onSelect(r.id))
        .addTo(group);
      markers.current.set(r.id, m);
      points.push([r.lat, r.lng]);
    }
    if (points.length) map.current.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }, [reports, onSelect]);

  useEffect(() => {
    if (selectedId) markers.current.get(selectedId)?.openPopup();
  }, [selectedId]);

  return <div ref={el} className="admin-map" aria-label="Mapa prijava" />;
}
