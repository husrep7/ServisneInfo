import axios from 'axios';
import type { Incident } from './types';

// U produkciji postaviti VITE_API_URL (npr. https://api.servisne.info)
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL  = API_URL.replace(/^http/, 'ws') + '/ws';

const api = axios.create({ baseURL: API_URL });

export async function fetchIncidents(params?: Record<string, string | number | boolean>): Promise<Incident[]> {
  // Bez filtera status-a — API po defaultu vraća active + scheduled za danas/budućnost
  const { data } = await api.get<Incident[]>('/incidents', { params: { status: 'all', today: true, ...params } });
  return data;
}

export async function fetchIncident(id: string): Promise<Incident> {
  const { data } = await api.get<Incident>(`/incidents/${id}`);
  return data;
}

export interface ScraperStatus {
  source:          string;
  incidents_found: number;
  incidents_new:   number;
  error:           string | null;
  ran_at:          string;
}

export async function fetchScraperStatus(): Promise<ScraperStatus[]> {
  const { data } = await api.get<ScraperStatus[]>('/scraper-status');
  return data;
}

export interface ReportInput {
  type:         string;
  title:        string;
  description:  string;
  address:      string;
  reporterName: string;
  contact:      string;
}

export async function postReport(report: ReportInput): Promise<void> {
  await api.post('/reports', report);
}

// WebSocket s automatskim ponovnim spajanjem (exponential backoff, max 30s)
export function connectWS(onUpdate: () => void): { close: () => void } {
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
