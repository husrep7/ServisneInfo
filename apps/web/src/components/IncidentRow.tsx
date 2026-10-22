import { useNavigate } from 'react-router-dom';
import type { Incident } from '../types';
import { TYPE_COLOR, TYPE_SHORT, getCompany, fmtDate, fmtTime } from '../types';

export function IncidentRow({ incident }: { incident: Incident }) {
  const navigate = useNavigate();
  const company  = getCompany(incident.type);
  const color    = TYPE_COLOR[incident.type];

  return (
    <div className="inc-row" onClick={() => navigate(`/incidents/${incident.id}`)}>
      {/* Company logo */}
      <div className="inc-row-icon" style={{ background: company.logoBg, padding: 6 }}>
        <img
          src={company.logo}
          alt={company.shortName}
          style={{ width: 40, height: 40, objectFit: 'contain' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <div className="inc-row-body">
        <div className="inc-row-meta">
          <span className="inc-type-tag" style={{ background: color }}>
            {TYPE_SHORT[incident.type]}
          </span>
          {incident.status === 'active'    && <span className="badge-live">AKTIVNO</span>}
          {incident.status === 'scheduled' && <span className="badge-scheduled">PLANIRANO</span>}
        </div>
        <div className="inc-row-title">{incident.title}</div>
        <div className="inc-row-sub">
          <span style={{ fontWeight: 600, color: '#949AA9' }}>{company.shortName}</span>
          <span>·</span>
          <span>{fmtDate(incident.created_at)}</span>
          {fmtTime(incident.starts_at) && (
            <>
              <span>u</span>
              <span style={{ fontWeight: 700 }}>{fmtTime(incident.starts_at)}</span>
            </>
          )}
        </div>
      </div>
      <span className="inc-row-arrow">›</span>
    </div>
  );
}
