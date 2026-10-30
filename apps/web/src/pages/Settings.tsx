import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { COMPANIES } from '../types';
import { useTheme } from '../context/ThemeContext';
import { fetchScraperStatus } from '../api';
import type { ScraperStatus } from '../api';
import { PageHeader } from '../components/PageHeader';
import { BrandMark, Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { APP_VERSION, CONTACT_EMAIL } from '../config';


function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'upravo';
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `prije ${h} h`;
  return `prije ${Math.floor(h / 24)} d`;
}

// Red u grupisanoj listi postavki: link (interni ili vanjski) ili samo prikaz vrijednosti
function Row({ icon, label, sub, value, to, href, external }: {
  icon: IconName; label: string; sub?: string; value?: ReactNode;
  to?: string; href?: string; external?: boolean;
}) {
  const body = (
    <>
      <span className="row-icon"><Icon name={icon} size={18} /></span>
      <span className="row-body">
        <span className="row-label">{label}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value">{value}</span>}
      {(to || href) && <Icon name={external ? 'external' : 'chevron'} size={16} className="row-chevron" />}
    </>
  );
  if (to)   return <Link to={to} className="row link">{body}</Link>;
  if (href) return <a href={href} className="row link" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{body}</a>;
  return <div className="row">{body}</div>;
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
      <PageHeader eyebrow="ServisneInfo" title="Profil" narrow />

      <div className="container narrow stack" style={{ marginTop: 20 }}>
        <div className="card profile-card">
          <BrandMark size={56} />
          <div>
            <div className="profile-name">ServisneInfo</div>
            <div className="profile-sub">Obavijesti o prekidima komunalnih usluga u Kantonu Sarajevo</div>
          </div>
        </div>

        <div className="card setting-row">
          <span className="setting-icon"><Icon name={theme === 'dark' ? 'moon' : 'sun'} /></span>
          <span className="setting-body">
            <span className="setting-label" style={{ display: 'block' }}>Izgled</span>
            <span className="setting-sub" style={{ display: 'block' }}>Tema aplikacije na ovom uređaju</span>
          </span>
          <Segmented label="Tema" value={theme} onChange={t => { if (t !== theme) toggle(); }}
            options={[
              { value: 'light', label: <><Icon name="sun" size={15} /> Svijetla</> },
              { value: 'dark',  label: <><Icon name="moon" size={15} /> Tamna</> },
            ]} />
        </div>

        <div className="group-title">Podrška</div>
        <div className="list-card">
          <Row icon="mail" label="Kontaktirajte nas" sub="Pitanja, greške u podacima, prijedlozi"
            href={`mailto:${CONTACT_EMAIL}`} value={CONTACT_EMAIL} />
          <Row icon="plus" label="Prijavi prekid" sub="Nešto ne radi, a nije objavljeno" to="/report" />
        </div>

        <div className="group-title">Izvori podataka</div>
        <div className="list-card">
          {COMPANIES.map(c => {
            const status   = getStatus(c.scraperSource);
            const hasError = status?.error != null;
            return (
              <div key={c.id} className="source-row">
                <span className="source-logo" style={{ '--company-bg': c.logoBg } as CSSProperties}>
                  <img src={c.logo} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </span>
                <span className="row-body">
                  <span className="row-label">{c.shortName}</span>
                  <span className="row-sub">
                    <span className={`source-dot${hasError ? ' err' : ''}`} />
                    {hasError ? 'Greška pri ažuriranju' : status?.ran_at ? `Ažurirano ${timeAgo(status.ran_at)}` : 'Bez podataka'}
                  </span>
                </span>
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="mini-btn" aria-label={`Pozovi ${c.shortName}: ${c.phone}`} title={c.phone}>
                  <Icon name="phone" size={15} />
                </a>
                <a href={c.url} target="_blank" rel="noreferrer" className="mini-btn" aria-label={`Web stranica: ${c.shortName}`} title={c.url}>
                  <Icon name="external" size={15} />
                </a>
              </div>
            );
          })}
        </div>

        <div className="group-title">Pravno</div>
        <div className="list-card">
          <Row icon="file" label="Uslovi korištenja" to="/uslovi" />
          <Row icon="shield" label="Politika privatnosti" to="/privatnost" />
        </div>

        <div className="group-title">O aplikaciji</div>
        <div className="list-card">
          <Row icon="info" label="Verzija" value={APP_VERSION} />
          <Row icon="refresh" label="Ažuriranje podataka" value="svakih 15 min" />
        </div>

        <p className="settings-foot">© {new Date().getFullYear()} ServisneInfo · Sarajevo</p>
      </div>
    </div>
  );
}
