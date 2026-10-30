import axios from 'axios';
import type { Incident, IncidentType } from '../types';
import { getToken, logout, setToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Pogrešan ili isključen token: briše se i traži ponovo (U12)
api.interceptors.response.use(undefined, (err) => {
  const status = err.response?.status;
  if ((status === 401 || status === 403) && getToken()) {
    logout();
    window.location.assign('/admin/login?expired=1');
  }
  return Promise.reject(err);
});

export type ReportStatus = 'pending' | 'confirmed' | 'rejected' | 'expired';

export interface AdminReport {
  id:            string;
  type:          IncidentType;
  title:         string;
  description:   string | null;
  address:       string;
  municipality:  string;
  reporter_name: string | null;
  contact:       string | null;
  reporter_key:  string | null;
  channel:       'web' | 'mobile';
  status:        ReportStatus;
  suppressed:    'blocked' | 'rate_limit' | null;
  confirmed_at:  string | null;
  confirmed_by:  'auto' | 'admin' | null;
  incident_id:   string | null;
  created_at:    string;
  lat:           number | null;
  lng:           number | null;
  blocked:       boolean;
}

export interface BlockedReporter {
  reporter_key: string;
  reason:       string | null;
  created_at:   string;
  reports:      number;
}

export type AdminIncident = Incident & { origin?: 'official' | 'user' };

// Provjerava token prije nego što ga sačuva; vraća false za 401/403
export async function verifyToken(token: string): Promise<boolean> {
  try {
    await axios.get(`${API_URL}/admin/reports`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}` },
    });
    setToken(token);
    return true;
  } catch (err) {
    if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) return false;
    throw err;
  }
}

export async function listReports(status: ReportStatus | 'all', limit = 200): Promise<AdminReport[]> {
  const { data } = await api.get<AdminReport[]>('/admin/reports', { params: { status, limit } });
  return data;
}

export async function confirmReport(id: string): Promise<{ incidentId: string }> {
  const { data } = await api.post<{ incidentId: string }>(`/admin/reports/${id}/confirm`);
  return data;
}

export async function rejectReport(id: string): Promise<void> {
  await api.post(`/admin/reports/${id}/reject`);
}

export async function blockReporter(reportId: string, reason?: string): Promise<void> {
  await api.post(`/admin/reports/${reportId}/block`, { reason: reason || undefined });
}

export async function listBlocked(): Promise<BlockedReporter[]> {
  const { data } = await api.get<BlockedReporter[]>('/admin/blocked');
  return data;
}

export async function unblock(reporterKey: string): Promise<void> {
  await api.delete(`/admin/blocked/${encodeURIComponent(reporterKey)}`);
}

export async function closeIncident(id: string): Promise<void> {
  await api.post(`/admin/incidents/${id}/close`);
}

// Javni endpointi, ali bez demo grane iz ../api.ts — admin uvijek gleda pravi backend
export async function listActiveIncidents(): Promise<AdminIncident[]> {
  const { data } = await api.get<AdminIncident[]>('/incidents', {
    params: { status: 'active', today: false, limit: 200 },
  });
  return data;
}

export interface ScraperRun {
  source:          string;
  incidents_found: number;
  incidents_new:   number;
  error:           string | null;
  ran_at:          string;
}

export async function listScraperRuns(): Promise<ScraperRun[]> {
  const { data } = await api.get<ScraperRun[]>('/scraper-status');
  return data;
}

// Poruka greške sa servera (npr. "Report is confirmed") ili opšta poruka
export function errorText(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
    if (!err.response) return 'Server nije dostupan.';
  }
  return 'Došlo je do greške.';
}
