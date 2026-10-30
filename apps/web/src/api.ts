import axios from 'axios';
import type { Incident, IncidentType } from './types';

// U produkciji postaviti VITE_API_URL (npr. https://api.servisne.info)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL  = API_URL.replace(/^http/, 'ws') + '/ws';

const api = axios.create({ baseURL: API_URL });

// Lokalni demo bez backenda (VITE_DEMO=1) — vidi demo.ts
const DEMO = import.meta.env.VITE_DEMO === '1';

export async function fetchIncidents(params?: Record<string, string | number | boolean>): Promise<Incident[]> {
  if (DEMO) {
    const { DEMO_INCIDENTS } = await import('./demo');
    return DEMO_INCIDENTS.filter(i => !params?.status || params.status === 'all' || i.status === params.status);
  }
  // Bez filtera status-a — API po defaultu vraća active + scheduled za danas/budućnost
  const { data } = await api.get<Incident[]>('/incidents', { params: { status: 'all', today: true, ...params } });
  return data;
}

export async function fetchIncident(id: string): Promise<Incident> {
  if (DEMO) {
    const { DEMO_INCIDENTS } = await import('./demo');
    const found = DEMO_INCIDENTS.find(i => i.id === id);
    if (!found) throw new Error('not found');
    return found;
  }
  const { data } = await api.get<Incident>(`/incidents/${id}`);
  return data;
}

export interface ScraperStatus {
  source:          string;
  incidents_found: number;
  incidents_new:   number;
  error:           string | null;
  ran_at:          string;
  // Backend #19: failing = uzastopne greške, empty = sumnjivo bez rezultata (stariji backend ne šalje)
  health?:         'ok' | 'failing' | 'empty';
  health_detail?:  string | null;
}

export async function fetchScraperStatus(): Promise<ScraperStatus[]> {
  if (DEMO) return (await import('./demo')).DEMO_SCRAPERS;
  const { data } = await api.get<ScraperStatus[]>('/scraper-status');
  return data;
}

export interface ReportInput {
  type:         IncidentType;
  title:        string;
  description:  string;
  address:      string;
  reporterName: string;
  contact:      string;
  lat?:         number;
  lng?:         number;
  reporterKey:  string;
}

export async function postReport(report: ReportInput): Promise<void> {
  if (DEMO) {
    const { addDemoReport } = await import('./demo');
    addDemoReport(report);
    return;
  }
  // Prazna opciona polja se ne šalju (backend ih čuva kao NULL)
  await api.post('/reports', {
    ...report,
    description:  report.description.trim() || undefined,
    reporterName: report.reporterName.trim() || undefined,
    contact:      report.contact.trim() || undefined,
    channel:      'web',
  });
}

// Nepotvrđena prijava građana (R15) — javni prikaz bez ličnih podataka
export interface PublicReport {
  id:           string;
  type:         IncidentType;
  title:        string;
  description:  string | null;
  address:      string;
  municipality: string;
  lat:          number | null;
  lng:          number | null;
  created_at:   string;
}

export async function fetchPublicReports(): Promise<PublicReport[]> {
  if (DEMO) return (await import('./demo')).DEMO_REPORTS;
  const { data } = await api.get<PublicReport[]>('/reports/public');
  return data;
}

export interface GeocodeResult {
  label: string;
  lat:   number;
  lng:   number;
}

export class GeocodeError extends Error {}

// Pretraga adrese u Kantonu Sarajevo (KTD12). Zove se samo na klik "Traži", što poštuje
// Nominatim limit od 1 zahtjeva u sekundi. Kad backend dobije /geocode (#42), ide preko njega.
export async function searchAddress(q: string): Promise<GeocodeResult[]> {
  let res: Response;
  try {
    res = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q, format: 'jsonv2', limit: '5', countrycodes: 'ba', bounded: '1',
      viewbox: '18.15,43.98,18.60,43.72', 'accept-language': 'bs',
    }));
  } catch {
    throw new GeocodeError('network');
  }
  if (!res.ok) throw new GeocodeError(String(res.status));
  const rows = await res.json() as { display_name: string; lat: string; lon: string }[];
  return rows.map(r => ({
    label: r.display_name.split(', ').slice(0, 3).join(', '),
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}

// WebSocket s automatskim ponovnim spajanjem (exponential backoff, max 30s)
export function connectWS(onUpdate: () => void): { close: () => void } {
  if (DEMO) return { close: () => {} };
  let ws: WebSocket | null = null;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const open = () => {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      // Nakon reconnecta osvježi podatke — mogli smo propustiti evente
      if (retry > 0) onUpdate();
      retry = 0;
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'incident:new' || msg.type === 'incident:resolved') onUpdate();
      } catch {}
    };
    ws.onclose = () => {
      if (closed) return;
      timer = setTimeout(open, Math.min(30_000, 1000 * 2 ** retry++));
    };
  };
  open();

  return {
    close: () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
