import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clickable } from '../a11y';
import { useNow } from '../hooks';
import type { Incident } from '../types';
import { getCompany, fmtWhen, fmtDate, incidentProgress, typeStyle } from '../types';
import { Icon, TypeIcon } from './Icon';

export function StatusBadge({ status }: { status: Incident['status'] }) {
  if (status === 'active')    return <span className="badge live">Aktivno</span>;
  if (status === 'scheduled') return <span className="badge scheduled">Planirano</span>;
  return <span className="badge resolved">Riješeno</span>;
}

const RING = 2 * Math.PI * 14;

// Aktivni: prsten koliko je prekida prošlo; planirani: "Počinje za …"
export function IncidentProgress({ incident, bar }: { incident: Incident; bar?: boolean }) {
  const now = useNow();
  const p = incidentProgress(incident, now);
  if (!p) return null;
  if (p.pct === null) return <div className={`progress ${incident.status}`}><span className="progress-label">{p.label}</span></div>;
  return (
    <div className={`progress ${incident.status}`} role="progressbar" aria-valuenow={Math.round(p.pct)}
      aria-valuemin={0} aria-valuemax={100} aria-label="Proteklo vrijeme prekida">
      {bar ? (
        <div className="progress-track"><div className="progress-fill" style={{ '--pct': `${p.pct}%` } as CSSProperties} /></div>
      ) : (
        <svg className="ring" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="14" className="ring-bg" />
          <circle cx="17" cy="17" r="14" className="ring-fg"
            style={{ '--dash': `${(p.pct / 100) * RING} ${RING}` } as CSSProperties} />
        </svg>
      )}
      <span className="progress-label">{p.label}</span>
    </div>
  );
}

export function IncidentCard({ incident, onClick, selected, action, index = 0 }: {
  incident: Incident;
  onClick?: () => void;
  selected?: boolean;
  action?: ReactNode;
  index?: number;     // za postepeno pojavljivanje u listi
}) {
  const navigate = useNavigate();
  const company  = getCompany(incident.type);
  const when     = fmtWhen(incident.starts_at, incident.ends_at) || fmtDate(incident.created_at);
  const addrs    = incident.affected_addresses?.slice(0, 2).join(', ');

  return (
    <div className={`inc-card reveal${selected ? ' selected' : ''}`}
      style={{ ...typeStyle(incident.type), '--d': `${Math.min(index, 8) * 50}ms` } as CSSProperties}
      {...clickable(onClick ?? (() => navigate(`/incidents/${incident.id}`)))}>
      <div className="inc-card-top">
        <div className="inc-card-icon"><TypeIcon type={incident.type} size={22} /></div>
        <StatusBadge status={incident.status} />
      </div>
      <div className="inc-card-title">{incident.title}</div>
      <div className="inc-card-meta">
        {incident.origin === 'user'
          ? <span className="inc-card-company inc-card-origin">Prijava korisnika</span>
          : <span className="inc-card-company">{company.shortName}</span>}
        {addrs && <span className="addr-text">{addrs}</span>}
      </div>
      {when && <div className="inc-card-when mono"><Icon name="clock" size={13} /> {when}</div>}
      <div className="inc-card-foot">
        <IncidentProgress incident={incident} />
        {action ?? <span className="inc-card-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>}
      </div>
    </div>
  );
}
