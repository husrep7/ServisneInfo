import { useEffect, useState } from 'react';
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
        <div className="profile-avatar" style={{ background: '#323B54', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="9" width="4" height="12"/><rect x="10" y="5" width="4" height="16"/><rect x="17" y="12" width="4" height="9"/><line x1="1" y1="21" x2="23" y2="21"/>
          </svg>
        </div>
        <div>
          <div className="profile-name">Servisne Informacije</div>
          <div className="profile-sub">Sarajevo, Bosna i Hercegovina</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            v1.0.0 · Ažurirano svakih 15 min
          </div>
        </div>
      </div>

      {/* Dark mode row */}
      <div className="settings-list" style={{ marginTop: 8 }}>
        <div className="settings-item" {...clickable(toggle)} aria-pressed={theme === 'dark'} style={{ cursor: 'pointer' }}>
          <div className="settings-item-icon" style={{ background: theme === 'dark' ? '#1a2a4a' : '#F0F4FF', fontSize: 18 }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
          <div className="settings-item-body">
            <div className="settings-item-label">Izgled</div>
            <div className="settings-item-sub">{theme === 'dark' ? 'Tamni mod' : 'Svjetli mod'}</div>
          </div>
          <div style={{
            width: 44, height: 24, borderRadius: 12,
            background: theme === 'dark' ? 'var(--primary)' : 'var(--border)',
            position: 'relative', transition: 'background .2s', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2,
              left: theme === 'dark' ? 22 : 2,
              width: 20, height: 20, borderRadius: 10,
              background: '#fff', transition: 'left .2s',
              boxShadow: '0 1px 4px rgba(0,0,0,.2)',
            }} />
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

          return (
            <div key={c.id} style={{
              borderBottom: '1px solid var(--border)',
              padding: '14px 16px',
            }}>
              {/* Top row: logo + name + status dot */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: c.logoBg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden',
                  border: '1px solid var(--border)',
                }}>
                  <img src={c.logo} alt={c.shortName}
                    style={{ width: 36, height: 36, objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{c.shortName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 1 }}>{c.name}</div>
                </div>

                {/* Scraper status indikator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: hasError ? '#ED1D1D' : '#96BE4F',
                    boxShadow: `0 0 6px ${hasError ? '#ED1D1D' : '#96BE4F'}`,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: hasError ? '#ED1D1D' : '#96BE4F' }}>
                    {hasError ? 'Greška' : 'Aktivan'}
                  </span>
                </div>
              </div>

              {/* Scraper info */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                  🕐 Zadnje ažuriranje: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{lastRun}</span>
                </div>
                {status && !hasError && (
                  <div style={{ fontSize: 11, color: 'var(--text-sec)' }}>
                    📋 Pronađeno: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{status.incidents_found}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  background: 'var(--bg)', border: '1.5px solid var(--border)',
                  fontSize: 13, fontWeight: 700, color: 'var(--text)',
                }}>
                  📞 {c.phone}
                </a>
                <a href={c.url} target="_blank" rel="noreferrer" style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  background: 'var(--primary)', border: '1.5px solid var(--primary)',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                }}>
                  🌐 Web
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── PRIJAVI INCIDENT ── */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button onClick={() => navigate('/report')} style={{
          background: '#ED1D1D', color: '#fff',
          border: 'none', borderRadius: 22, padding: '10px 20px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontFamily: 'Quicksand, sans-serif',
          boxShadow: '0 3px 12px rgba(237,29,29,0.35)',
        }}>
          <span style={{ fontSize: 13 }}>📢</span>
          Prijavi incident
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-sec)', marginTop: 10 }}>
          Primijeti problem koji nije objavljen? Javi nam odmah.
        </p>
      </div>
    </div>
  );
}
