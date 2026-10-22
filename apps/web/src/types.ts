export type IncidentType = 'water' | 'electricity' | 'gas' | 'heating' | 'internet';
export type IncidentStatus = 'active' | 'resolved' | 'scheduled';

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string | null;
  source_url: string | null;
  affected_addresses: string[] | null;
  municipality: string;
  starts_at: string | null;
  ends_at: string | null;
  status: IncidentStatus;
  created_at: string;
  area_geojson: { type: 'Polygon'; coordinates: number[][][] } | null;
  distance_meters: number | null;
}

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
export const TYPE_ICON: Record<IncidentType, string> = {
  water: '💧', electricity: '⚡', gas: '🔥', heating: '🏠', internet: '🌐',
};
export const TYPE_COLOR: Record<IncidentType, string> = {
  water: '#007AFF', electricity: '#ECBD34', gas: '#EC5E78',
  heating: '#C281D1', internet: '#8BB0BA',
};

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
