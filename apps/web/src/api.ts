import axios from 'axios';
import type { Incident } from './types';

const api = axios.create({ baseURL: 'http://localhost:3000' });

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

export function connectWS(onUpdate: () => void): WebSocket {
  const ws = new WebSocket('ws://localhost:3000/ws');
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'incident:new' || msg.type === 'incident:resolved') onUpdate();
    } catch {}
  };
  return ws;
}
