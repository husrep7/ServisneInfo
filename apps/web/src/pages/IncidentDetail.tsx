import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchIncident } from '../api';
import type { Incident } from '../types';
import { TYPE_LABEL, TYPE_COLOR, fmtDateTime, getCompany, typeStyle } from '../types';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/IncidentCard';
import { Icon, TypeIcon } from '../components/Icon';
import { EmptyState } from '../components/States';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading]   = useState(true);
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

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

  if (loading) return <div className="page"><div className="spinner"><div className="spinner-ring" /></div></div>;
  if (!incident) {
    return (
      <div className="page">
        <PageHeader back title="Prekid" />
        <EmptyState icon="alert" tone="neutral" title="Prekid nije pronađen"
          action={<Link to="/" className="btn secondary">Idi na početnu</Link>}>
          Obavijest je možda uklonjena ili link nije ispravan.
        </EmptyState>
      </div>
    );
  }

  const company = getCompany(incident.type);

  return (
    <div className="page" style={typeStyle(incident.type)}>
      <PageHeader back title={incident.title}
        eyebrow={<span style={{ color: 'var(--type-color)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TypeIcon type={incident.type} size={14} /> {TYPE_LABEL[incident.type]}
        </span>} />

      <div className="container detail-layout">
        <div className="stack">
          <div className="card">
            <StatusBadge status={incident.status} />
            {(incident.starts_at || incident.ends_at) && (
              <div className="time-grid">
                {incident.starts_at && (
                  <div>
                    <div className="time-label">Početak</div>
                    <div className="time-value">{fmtDateTime(incident.starts_at)}</div>
                  </div>
                )}
                {incident.ends_at && (
                  <div>
                    <div className="time-label">Kraj</div>
                    <div className="time-value">{fmtDateTime(incident.ends_at)}</div>
                  </div>
                )}
              </div>
            )}
            <div className="detail-company">
              <div className="inc-card-icon"><TypeIcon type={incident.type} size={20} /></div>
              {incident.origin === 'user' ? (
                <div>
                  Prijava korisnika
                  <small>Potvrđeno na osnovu prijava građana, nije službena obavijest preduzeća {company.shortName}.</small>
                </div>
              ) : (
                <div>
                  {company.shortName}
                  <small>{company.name}</small>
                </div>
              )}
            </div>
          </div>

          {incident.affected_addresses?.length ? (
            <div className="card">
              <div className="card-title">Zahvaćene ulice</div>
              <div className="chips">
                {incident.affected_addresses.map(a => (
                  <span key={a} className="chip"><Icon name="pin" size={14} /> {a}</span>
                ))}
              </div>
            </div>
          ) : null}

          {incident.description && (
            <div className="card">
              <div className="card-title">Opis</div>
              <p className="detail-description">{incident.description}</p>
            </div>
          )}

          {incident.source_url && (
            <a href={incident.source_url} target="_blank" rel="noreferrer" className="btn block tinted">
              Otvori zvanični izvor <Icon name="external" size={16} />
            </a>
          )}
        </div>

        <div className="detail-map-col">
          <div className="detail-map" ref={mapRef} />
        </div>
      </div>
    </div>
  );
}
