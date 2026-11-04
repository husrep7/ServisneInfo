import axios, { AxiosError } from 'axios';
import type { Incident, IncidentType } from './types';
import { getSession, setSession } from './session';
import type { Session, User } from './session';

// U produkciji postaviti VITE_API_URL (npr. https://api.servisne.info)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL  = API_URL.replace(/^http/, 'ws') + '/ws';

const api = axios.create({ baseURL: API_URL });

// Prijavljeni korisnik šalje token sesije; istekla sesija (401 na /auth/me) se briše
api.interceptors.request.use(cfg => {
  const s = getSession();
  if (s && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${s.token}`;
  return cfg;
});

export const FEEDS_URL = `${API_URL}/feeds`;

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

// Poruka greške sa backenda ({ error }) ili opšta poruka
export function errorMessage(err: unknown, fallback = 'Nešto nije u redu. Pokušajte ponovo.'): string {
  if (err instanceof AxiosError) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
    if (!err.response) return 'Nema veze sa serverom. Provjerite internet.';
  }
  return fallback;
}

// ── Računi (ADR-0003) ──

export async function fetchAuthConfig(): Promise<{ googleClientId: string | null }> {
  const { data } = await api.get<{ googleClientId: string | null }>('/auth/config');
  return data;
}

async function authCall(path: string, body: unknown): Promise<Session> {
  const { data } = await api.post<Session>(path, body);
  setSession(data);
  return data;
}

export const register = (email: string, password: string, name?: string) =>
  authCall('/auth/register', { email, password, name: name?.trim() || undefined });
export const login = (email: string, password: string) => authCall('/auth/login', { email, password });
export const loginWithGoogle = (credential: string) => authCall('/auth/google', { credential });
export const resetPassword = (token: string, password: string) => authCall('/auth/password/reset', { token, password });

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/password/forgot', { email });
}

// Provjera sačuvane sesije pri otvaranju aplikacije
export async function refreshMe(): Promise<void> {
  const s = getSession();
  if (!s) return;
  try {
    const { data } = await api.get<{ user: User }>('/auth/me');
    setSession({ token: s.token, user: data.user });
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 401) setSession(null);
  }
}

export async function logout(): Promise<void> {
  try { await api.post('/auth/logout'); } catch { /* sesija se briše i bez servera */ }
  setSession(null);
}

// ── Lokacija (ADR-0004, ADR-0005) ──

// Geokodiranje dijeli red sa scraperima, pa backend ponekad vrati 429: probaj još dvaput
async function getWithRetry<T>(path: string, params: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await api.get<T>(path, { params });
      return data;
    } catch (err) {
      const busy = err instanceof AxiosError && err.response?.status === 429;
      if (!busy || attempt >= 2) throw err;
      await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
    }
  }
}

export interface NearbyIncident extends Incident {
  inside: boolean;
}

export interface NearbyResult {
  address:   { street: string | null; area: string | null; label: string } | null;
  incidents: NearbyIncident[];
}

export const fetchNearby = (lat: number, lng: number, radius = 1500) =>
  getWithRetry<NearbyResult>('/nearby', { lat, lng, radius });

export type PlaceCategory = 'atm' | 'fuel' | 'post' | 'pharmacy' | 'bank';

export interface Place {
  id:            string;
  category:      PlaceCategory;
  name:          string;
  lat:           number;
  lng:           number;
  distance_m:    number;
  address:       string | null;
  opening_hours: string | null;
  brand:         string | null;
  outages:       IncidentType[];
}

export const fetchPlaces = (category: PlaceCategory, lat: number, lng: number, limit = 6) =>
  getWithRetry<Place[]>('/places/nearby', { category, lat, lng, limit });

export type SmartSearchResult =
  | { kind: 'places'; query: { category: PlaceCategory; place: string | null }; center: GeocodeResult; places: Place[] }
  | { kind: 'address'; query: { category: null; place: string | null }; addresses: GeocodeResult[] };

export const smartSearch = (q: string, near?: { lat: number; lng: number }) =>
  getWithRetry<SmartSearchResult>('/search', { q, ...near });

export interface RouteOption {
  distance_m:  number;
  duration_s:  number;
  geometry:    { type: 'LineString'; coordinates: [number, number][] };
  works:       { id: string; type: IncidentType; title: string; status: string }[];
  recommended: boolean;
}

export async function planRoute(from: [number, number], to: [number, number], mode: 'car' | 'foot'): Promise<RouteOption[]> {
  const data = await getWithRetry<{ routes: RouteOption[] }>('/route', {
    from: from.join(','), to: to.join(','), mode,
  });
  return data.routes;
}

