import type { CSSProperties } from 'react';
import type { Incident, IncidentType } from '@servisneinfo/shared';

export type { Incident, IncidentType, IncidentStatus } from '@servisneinfo/shared';

export const TYPE_LABEL: Record<IncidentType, string> = {
  water:       'Vodovod i kanalizacija',
  electricity: 'Električna energija',
  gas:         'Prirodni gas',
  heating:     'Centralno grijanje',
  internet:    'Internet i telekomunikacije',
};

export const TYPE_SHORT: Record<IncidentType, string> = {
  water: 'Vodovod', electricity: 'Elektro', gas: 'Gas', heating: 'Grijanje', internet: 'Internet',
};

export interface Company {
  id:        string;
  name:      string;
  shortName: string;
  type:      IncidentType;
  logo:      string;
  logoBg:    string;
  url:       string;
  phone:     string;
  scraperSource: string;  // matches scraper_runs.source
}

export const COMPANIES: Company[] = [
  {
    id: 'viksa',
    name: 'KJKP Vodovod i Kanalizacija Sarajevo',
    shortName: 'ViK Sarajevo',
    type: 'water',
    logo: '/logos/viksa.png',
    logoBg: '#EAF4FB',
    url: 'https://www.viksa.ba',
    phone: '080 020 020',
    scraperSource: 'KJKP Vodovod',
  },
  {
    id: 'epbih',
    name: 'Elektroprivreda BiH — Elektrodistribucija',
    shortName: 'EPBiH',
    type: 'electricity',
    logo: '/logos/epbih.png',
    logoBg: '#FFF9E6',
    url: 'https://www.epbih.ba',
    phone: '033 751 000',
    scraperSource: 'Elektrodistribucija EPBiH',
  },
  {
    id: 'sarajevogas',
    name: 'KJKP Sarajevogas',
    shortName: 'Sarajevogas',
    type: 'gas',
    logo: '/logos/sarajevogas.png',
    logoBg: '#1a2a4a',
    url: 'https://www.sarajevogas.ba',
    phone: '033 279 800',
    scraperSource: 'Sarajevogas',
  },
  {
    id: 'toplane',
    name: 'KJKP Toplane Sarajevo',
    shortName: 'Toplane',
    type: 'heating',
    logo: '/logos/toplane.png',
    logoBg: '#F5EEF8',
    url: 'https://www.toplanesarajevo.ba',
    phone: '033 678 145',
    scraperSource: 'Toplane Sarajevo',
  },
  {
    id: 'bhtelecom',
    name: 'BH Telecom',
    shortName: 'BH Telecom',
    type: 'internet',
    logo: '/logos/bhtelecom.webp',
    logoBg: '#E8F4FD',
    url: 'https://www.bhtelecom.ba',
    phone: '1444',
    scraperSource: 'BH Telecom',
  },
];

export function getCompany(type: IncidentType): Company {
  return COMPANIES.find(c => c.type === type) ?? COMPANIES[0];
}
// Kratki naziv usluge za pregled stanja
export const TYPE_SERVICE: Record<IncidentType, string> = {
  water: 'Voda', electricity: 'Struja', gas: 'Gas', heating: 'Grijanje', internet: 'Internet',
};

export const TYPE_ICON: Record<IncidentType, string> = {
  water: '💧', electricity: '⚡', gas: '🔥', heating: '🏠', internet: '🌐',
};
export const TYPE_COLOR: Record<IncidentType, string> = {
  water: 'var(--water)', electricity: 'var(--electricity)', gas: 'var(--gas)',
  heating: 'var(--heating)', internet: 'var(--internet)',
};
export const TYPE_BG: Record<IncidentType, string> = {
  water: 'var(--water-bg)', electricity: 'var(--electricity-bg)', gas: 'var(--gas-bg)',
  heating: 'var(--heating-bg)', internet: 'var(--internet-bg)',
};

// CSS varijable --type-color / --type-bg za komponente obojene po tipu usluge
export function typeStyle(type: IncidentType): CSSProperties {
  return { '--type-color': TYPE_COLOR[type], '--type-bg': TYPE_BG[type] } as CSSProperties;
}

const TZ = 'Europe/Sarajevo';

export function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('hr', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
}
export function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  // Ne prikazuj ponoć (00:00) — znači da satnica nije dostupna
  if (time === '00:00') return '';
  return time;
}
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const time = fmtTime(iso);
  return time ? `${fmtDate(iso)} u ${time}` : fmtDate(iso);
}

// Kalendarski dan u Sarajevu (YYYY-MM-DD) — za "Danas"/"Sutra"
function sarajevoDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const key = sarajevoDay(d);
  if (key === sarajevoDay(new Date(now)))          return 'Danas';
  if (key === sarajevoDay(new Date(now + 864e5)))  return 'Sutra';
  if (key === sarajevoDay(new Date(now - 864e5)))  return 'Jučer';
  return d.toLocaleDateString('hr', { day: 'numeric', month: 'numeric', timeZone: TZ });
}

// "Danas 08:00 – 13:00", "Sutra 22:00 – 31. 10. 06:00"
export function fmtWhen(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return '';
  const st = fmtTime(startsAt);
  let out = dayLabel(startsAt) + (st ? ` ${st}` : '');
  if (endsAt) {
    const et = fmtTime(endsAt);
    const sameDay = sarajevoDay(new Date(startsAt)) === sarajevoDay(new Date(endsAt));
    if (!sameDay) out += ` – ${dayLabel(endsAt)}${et ? ` ${et}` : ''}`;
    else if (et) out += ` – ${et}`;
  }
  return out;
}

// Bosanska množina: 1 prekid, 2–4 prekida, 5+ prekida
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Nepotvrđena prijava ističe 6 sati nakon slanja (KTD10)
export const REPORT_TTL_H = 6;

export function reportExpiresIn(createdAt: string): string {
  const left = new Date(createdAt).getTime() + REPORT_TTL_H * 3600e3 - Date.now();
  if (left <= 0) return 'uskoro ističe';
  const h = Math.floor(left / 3600e3);
  const m = Math.round((left % 3600e3) / 60e3);
  return h > 0 ? `ističe za ${h} h` : `ističe za ${m} min`;
}

export function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1)  return 'upravo';
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `prije ${h} h`;
  return `prije ${Math.floor(h / 24)} d`;
}

// "3 h 20 min", "45 min", "2 d"
export function fmtDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.round(h / 24)} d`;
}

// Napredak prekida za traku na kartici: aktivni → koliko je prošlo, planirani → kad počinje
export function incidentProgress(i: Incident, now = Date.now()): { pct: number | null; label: string } | null {
  const start = i.starts_at ? new Date(i.starts_at).getTime() : null;
  const end   = i.ends_at   ? new Date(i.ends_at).getTime()   : null;
  if (i.status === 'scheduled') {
    return start && start > now ? { pct: null, label: `Počinje za ${fmtDuration(start - now)}` } : null;
  }
  if (i.status !== 'active') return null;
  if (!end) return { pct: null, label: 'Kraj nije najavljen' };
  if (end <= now) return { pct: 100, label: 'Trebalo je završiti' };
  const pct = start && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : null;
  return { pct, label: `Još ${fmtDuration(end - now)}` };
}
