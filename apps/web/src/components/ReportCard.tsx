import { useState } from 'react';
import type { PublicReport } from '../api';
import { TYPE_SERVICE, reportExpiresIn, timeAgo, typeStyle } from '../types';
import { Icon, TypeIcon } from './Icon';

export function UnconfirmedBadge() {
  return <span className="badge unconfirmed">Nepotvrđeno</span>;
}

// Nepotvrđena prijava građana: ne vodi na detalje prekida, nego se otvara na mjestu (U8 korak 5)
export function ReportCard({ report, onFocus, selected }: {
  report: PublicReport;
  onFocus?: () => void;
  selected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => { setOpen(o => !o); onFocus?.(); };

  return (
    <div className={`inc-card report-card${selected ? ' selected' : ''}`} style={typeStyle(report.type)}>
      <div className="inc-card-icon"><TypeIcon type={report.type} size={22} /></div>
      <div className="inc-card-body">
        <button className="report-card-head" onClick={toggle} aria-expanded={open}>
          <span className="inc-card-top">
            <UnconfirmedBadge />
            <span className="inc-card-company">{TYPE_SERVICE[report.type]} · prijava građana</span>
          </span>
          <span className="inc-card-title">{report.title}</span>
          <span className="inc-card-meta">
            <span><Icon name="clock" size={14} /> {timeAgo(report.created_at)}</span>
            <span className="addr"><Icon name="pin" size={14} /> <span className="addr-text">{report.address}</span></span>
          </span>
        </button>
        {open && (
          <div className="report-card-more">
            {report.description && <p>{report.description}</p>}
            <p className="report-card-note">
              Nepotvrđeno – čeka potvrdu, {reportExpiresIn(report.created_at)}.
            </p>
          </div>
        )}
      </div>
      <Icon name="down" size={18} className={`inc-card-arrow group-chevron${open ? ' open' : ''}`} />
    </div>
  );
}
