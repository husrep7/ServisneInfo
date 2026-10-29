import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchIncident } from '../api';
import type { Incident } from '../types';
import { TYPE_LABEL, TYPE_ICON, TYPE_COLOR, fmtDateTime } from '../types';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function IncidentDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading]   = useState(true);
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchIncident(id)
      .then(setIncident)
      .catch(() => setIncident(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!incident || !mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([43.8563, 18.4131], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    mapInstance.current = map;

    if (incident.area_geojson) {
      const color = TYPE_COLOR[incident.type];
      const layer = L.geoJSON(incident.area_geojson, {
        style: { color, fillColor: color, fillOpacity: 0.2, weight: 2 },
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }

    return () => { map.remove(); mapInstance.current = null; };
  }, [incident]);

  if (loading) return <div className="spinner" style={{ paddingTop: 100 }}><div className="spinner-ring" /></div>;
  if (!incident) return <div className="empty"><div className="empty-title">Incident nije pronađen.</div></div>;

  const color = TYPE_COLOR[incident.type];

  return (
    <div className="page">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Nazad">‹</button>
        <div style={{ flex: 1 }}>
          <div className="detail-type" style={{ color }}>
            {TYPE_ICON[incident.type]} {TYPE_LABEL[incident.type]}
          </div>
          <div className="detail-title">{incident.title}</div>
        </div>
      </div>

      <div className="detail-body">
        {/* Status + time */}
        <div className="time-row">
          <div>
            <span className={`badge-${incident.status === 'active' ? 'live' : incident.status === 'scheduled' ? 'scheduled' : 'resolved'}`}>
              {incident.status === 'active' ? 'AKTIVNO' : incident.status === 'scheduled' ? 'PLANIRANO' : 'RIJEŠENO'}
            </span>
          </div>
          {incident.starts_at && (
            <div className="time-block">
              <label>Početak</label>
              <span>{fmtDateTime(incident.starts_at)}</span>
            </div>
          )}
          {incident.ends_at && (
            <div className="time-block">
              <label>Kraj</label>
              <span>{fmtDateTime(incident.ends_at)}</span>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="detail-map" ref={mapRef} style={{ height: 240 }} />

        {/* Addresses */}
        {incident.affected_addresses?.length ? (
          <div className="detail-section">
            <div className="detail-section-title">Zahvaćene ulice</div>
            <div>
              {incident.affected_addresses.map(a => (
                <span key={a} className="address-pill">📍 {a}</span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Description */}
        {incident.description && (
          <div className="detail-section">
            <div className="detail-section-title">Opis</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#444' }}>{incident.description}</p>
          </div>
        )}

        {/* Source */}
        {incident.source_url && (
          <a href={incident.source_url} target="_blank" rel="noreferrer"
            className="source-btn" style={{ background: color }}>
            Otvori zvanični izvor →
          </a>
        )}
      </div>
    </div>
  );
}
