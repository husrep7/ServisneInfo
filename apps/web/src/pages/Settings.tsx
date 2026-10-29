import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMPANIES } from '../types';
import { useTheme } from '../context/ThemeContext';
import { fetchScraperStatus } from '../api';
import type { ScraperStatus } from '../api';
import { clickable } from '../a11y';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'upravo';
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `prije ${h} h`;
  return `prije ${Math.floor(h / 24)} d`;
}

export default function Settings() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus[]>([]);

  useEffect(() => {
    fetchScraperStatus().then(setScraperStatus).catch(() => {});
  }, []);

  const getStatus = (source: string) =>
    scraperStatus.find(s => s.source === source);

  return (
    <div className="page">
      {/* Header */}
      <div className="s-header" style={{ paddingBottom: 20 }}>
        <div>
          <div className="s-header-label">Servisne Informacije</div>
          <div className="s-header-title" style={{ fontSize: 20 }}>O aplikaciji</div>
        </div>
      </div>

      {/* App info */}
      <div className="profile-block">
        <div className="profile-avatar app-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="9" width="4" height="12"/><rect x="10" y="5" width="4" height="16"/><rect x="17" y="12" width="4" height="9"/><line x1="1" y1="21" x2="23" y2="21"/>
          </svg>
        </div>
        <div>
          <div className="profile-name">Servisne Informacije</div>
          <div className="profile-sub">Sarajevo, Bosna i Hercegovina</div>
          <div className="profile-version">
            v1.0.0 · Ažurirano svakih 15 min
          </div>
        </div>
      </div>

      {/* Dark mode row */}
      <div className="settings-list" style={{ marginTop: 8 }}>
        <div className="settings-item" {...clickable(toggle)} aria-pressed={theme === 'dark'}>
          <div className="settings-item-icon theme-icon" style={{ fontSize: 18 }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
          <div className="settings-item-body">
            <div className="settings-item-label">Izgled</div>
            <div className="settings-item-sub">{theme === 'dark' ? 'Tamni mod' : 'Svjetli mod'}</div>
          </div>
          <div className={`toggle-switch${theme === 'dark' ? ' on' : ''}`}>
            <div className="toggle-switch-dot" />
          </div>
        </div>
      </div>

      {/* ── PREDUZEĆA ── */}
      <div className="s-section" style={{ marginTop: 20 }}>
        <span className="s-section-title">Preduzeća i izvori podataka</span>
      </div>

      <div style={{ background: 'var(--card)' }}>
        {COMPANIES.map(c => {
          const status = getStatus(c.scraperSource);
          const hasError = status?.error != null;
          const lastRun  = status?.ran_at ? timeAgo(status.ran_at) : '—';
          const statusColor = hasError ? 'var(--live)' : 'var(--green)';

          return (
            <div key={c.id} className="company-card">
              {/* Top row: logo + name + status dot */}
              <div className="company-card-top">
                <div className="company-logo" style={{ width: 48, height: 48, '--company-bg': c.logoBg } as CSSProperties}>
                  <img src={c.logo} alt={c.shortName}
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>

                <div className="company-row-body">
                  <div className="company-card-name">{c.shortName}</div>
                  <div className="company-card-fullname">{c.name}</div>
                </div>

                {/* Scraper status indikator */}
                <div className="company-status" style={{ '--accent': statusColor } as CSSProperties}>
                  <div className="company-status-dot" />
                  <span className="company-status-label">
                    {hasError ? 'Greška' : 'Aktivan'}
                  </span>
                </div>
              </div>

              {/* Scraper info */}
              <div className="company-meta-row">
                <div>
                  🕐 Zadnje ažuriranje: <b>{lastRun}</b>
                </div>
                {status && !hasError && (
                  <div>
                    📋 Pronađeno: <b>{status.incidents_found}</b>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="company-actions">
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="action-btn">
                  📞 {c.phone}
                </a>
                <a href={c.url} target="_blank" rel="noreferrer" className="action-btn primary">
                  🌐 Web
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PRIJAVI INCIDENT ── */}
      <div className="report-cta-wrap">
        <button onClick={() => navigate('/report')} className="report-cta-btn">
          <span style={{ fontSize: 13 }}>📢</span>
          Prijavi incident
        </button>
        <p className="report-cta-hint">
          Primijeti problem koji nije objavljen? Javi nam odmah.
        </p>
      </div>
    </div>
  );
}
