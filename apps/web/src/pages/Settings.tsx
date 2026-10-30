import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { COMPANIES } from '../types';
import { useTheme } from '../context/ThemeContext';
import { fetchScraperStatus } from '../api';
import type { ScraperStatus } from '../api';
import { PageHeader } from '../components/PageHeader';
import { BrandMark, Icon } from '../components/Icon';
import { MyAddresses } from '../components/MyAddresses';

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
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus[]>([]);

  useEffect(() => {
    fetchScraperStatus().then(setScraperStatus).catch(() => {});
  }, []);

  const getStatus = (source: string) => scraperStatus.find(s => s.source === source);

  return (
    <div className="page">
      <PageHeader eyebrow="ServisneInfo" title="O aplikaciji" />

      <div className="container narrow stack" style={{ marginTop: 20 }}>
        <div className="card profile-card">
          <BrandMark size={56} />
          <div>
            <div className="profile-name">ServisneInfo</div>
            <div className="profile-sub">Kanton Sarajevo, Bosna i Hercegovina</div>
            <div className="profile-version">v1.0.0 · Ažurirano svakih 15 min</div>
          </div>
        </div>

        <button className="card setting-row" onClick={toggle} aria-pressed={theme === 'dark'}>
          <span className="setting-icon"><Icon name={theme === 'dark' ? 'moon' : 'sun'} /></span>
          <span className="setting-body">
            <span className="setting-label" style={{ display: 'block' }}>Izgled</span>
            <span className="setting-sub" style={{ display: 'block' }}>{theme === 'dark' ? 'Tamni mod' : 'Svijetli mod'}</span>
          </span>
          <span className={`toggle${theme === 'dark' ? ' on' : ''}`}><span className="toggle-dot" /></span>
        </button>

        <MyAddresses />

        <div className="section-head" style={{ marginTop: 12, marginBottom: 0 }}>
          <h2 className="section-title">Preduzeća i izvori podataka</h2>
        </div>

        <div className="sources">
          {COMPANIES.map(c => {
            const status   = getStatus(c.scraperSource);
            const health   = status?.health ?? (status?.error != null ? 'failing' : 'ok');
            const hasError = health !== 'ok';
            const lastRun  = status?.ran_at ? timeAgo(status.ran_at) : '—';

            return (
              <div key={c.id} className="card">
                <div className="source-top">
                  <div className="source-logo" style={{ '--company-bg': c.logoBg } as CSSProperties}>
                    <img src={c.logo} alt={c.shortName}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="source-name">{c.shortName}</div>
                    <div className="source-fullname">{c.name}</div>
                  </div>
                  <span className={`badge ${hasError ? 'live' : 'resolved'}`}>
                    {health === 'failing' ? 'Ne radi' : health === 'empty' ? 'Provjera' : 'Aktivan'}
                  </span>
                </div>

                {hasError && (
                  <p className="source-warning" role="status">
                    {health === 'failing'
                      ? 'Preuzimanje obavijesti sa stranice preduzeća trenutno ne radi. Provjerite njihovu stranicu direktno.'
                      : 'Već neko vrijeme ne nalazimo nove obavijesti sa ove stranice. Moguće je da su promijenili stranicu, pa provjerite i direktno.'}
                  </p>
                )}

                <div className="source-meta">
                  <span>Zadnje ažuriranje: <b>{lastRun}</b></span>
                  {status && !hasError && <span>Pronađeno: <b>{status.incidents_found}</b></span>}
                </div>

                <div className="source-actions">
                  <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="btn secondary">
                    <Icon name="phone" size={15} /> {c.phone}
                  </a>
                  <a href={c.url} target="_blank" rel="noreferrer" className="btn primary">
                    <Icon name="external" size={15} /> Web
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card cta-card" style={{ marginTop: 12 }}>
          <p>Primijetili ste problem koji nije objavljen? Javite nam odmah.</p>
          <Link to="/report" className="btn danger"><Icon name="plus" size={16} /> Prijavi incident</Link>
        </div>

        <p className="legal-link">
          <Link to="/privatnost">Privatnost i uslovi korištenja</Link>
        </p>
      </div>
    </div>
  );
}
