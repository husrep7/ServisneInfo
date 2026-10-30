import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { clickable } from '../a11y';
import type { Incident } from '../types';
import { getCompany, fmtWhen, fmtDate, typeStyle } from '../types';
import { Icon, TypeIcon } from './Icon';

export function StatusBadge({ status }: { status: Incident['status'] }) {
  if (status === 'active')    return <span className="badge live">Aktivno</span>;
  if (status === 'scheduled') return <span className="badge scheduled">Planirano</span>;
  return <span className="badge resolved">Riješeno</span>;
}

export function IncidentCard({ incident, onClick, selected, action }: {
  incident: Incident;
  onClick?: () => void;
  selected?: boolean;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const company  = getCompany(incident.type);
  const when     = fmtWhen(incident.starts_at, incident.ends_at) || fmtDate(incident.created_at);
  const addrs    = incident.affected_addresses?.slice(0, 2).join(', ');

  return (
    <div className={`inc-card${selected ? ' selected' : ''}`} style={typeStyle(incident.type)}
      {...clickable(onClick ?? (() => navigate(`/incidents/${incident.id}`)))}>
      <div className="inc-card-icon"><TypeIcon type={incident.type} size={22} /></div>
      <div className="inc-card-body">
        <div className="inc-card-top">
          <StatusBadge status={incident.status} />
          <span className="inc-card-company">{company.shortName}</span>
        </div>
        <div className="inc-card-title">{incident.title}</div>
        <div className="inc-card-meta">
          {when && <span><Icon name="clock" size={14} /> {when}</span>}
          {addrs && <span className="addr"><Icon name="pin" size={14} /> <span className="addr-text">{addrs}</span></span>}
        </div>
      </div>
      {action ?? <Icon name="chevron" size={18} className="inc-card-arrow" />}
    </div>
  );
}
