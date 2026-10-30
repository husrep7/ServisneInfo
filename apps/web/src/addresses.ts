// Sačuvane adrese na webu ostaju samo u browseru (KTD2) i služe za filter "Kod mene" (R4)
import { useSyncExternalStore } from 'react';
import type { Incident } from './types';
import { readJSON, writeJSON } from './storage';

export const MAX_ADDRESSES = 5;
const KEY = 'si_addresses';
const REPORTER_KEY = 'si_reporter_id';

export interface SavedAddress {
  id:    string;
  label: string;
  text:  string;
  lat:   number;
  lng:   number;
}

// Bez localStorage-a adrese žive samo dok je stranica otvorena
let memory: SavedAddress[] | null = null;
const listeners = new Set<() => void>();

export function loadAddresses(): SavedAddress[] {
  return memory ?? (memory = readJSON<SavedAddress[]>(KEY, []).filter(a =>
    typeof a?.lat === 'number' && typeof a?.lng === 'number' && typeof a?.text === 'string'));
}

// Vraća false ako adrese nisu trajno sačuvane (blokiran localStorage)
export function saveAddresses(list: SavedAddress[]): boolean {
  memory = list.slice(0, MAX_ADDRESSES);
  listeners.forEach(fn => fn());
  return writeJSON(KEY, memory);
}

export function subscribeAddresses(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeAddress(label: string, text: string, lat: number, lng: number): SavedAddress {
  return { id: newId(), label: label.trim() || text, text, lat, lng };
}

// Anonimni ID prijavioca (KTD7) — za limit i blokadu, ne identifikuje osobu
let sessionReporter: string | null = null;
export function reporterId(): string {
  const stored = readJSON<string | null>(REPORTER_KEY, null);
  if (stored) return stored;
  const id = sessionReporter ?? (sessionReporter = `web-${newId()}`);
  writeJSON(REPORTER_KEY, id);
  return id;
}

// Ray casting nad GeoJSON prstenom ([lng, lat] parovi)
function inRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function zoneContains(incident: Incident, lat: number, lng: number): boolean {
  const poly = incident.area_geojson;
  if (!poly || poly.type !== 'Polygon' || !poly.coordinates.length) return false;
  const [outer, ...holes] = poly.coordinates;
  return inRing(lat, lng, outer) && !holes.some(h => inRing(lat, lng, h));
}

export function isNearMe(incident: Incident, addresses: SavedAddress[]): boolean {
  return addresses.some(a => zoneContains(incident, a.lat, a.lng));
}

// React hook: lista adresa koja se osvježava kad se promijeni u Postavkama
export function useAddresses(): SavedAddress[] {
  return useSyncExternalStore(subscribeAddresses, loadAddresses);
}
