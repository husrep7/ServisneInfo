import axios from "axios";
import Constants from "expo-constants";
import type { Incident, IncidentType } from "@servisneinfo/shared";

// localhost na telefonu je sam telefon — postaviti EXPO_PUBLIC_API_URL
// (LAN IP računara u developmentu, npr. http://192.168.1.10:3000, ili produkcijski URL)
export const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://localhost:3000";

export const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws";

export const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// tokenId uređaja ide samo u headeru, nikad u URL-u (KTD1). Postavlja ga services/device.ts.
const DEVICE_HEADER = "x-device-token";
let deviceToken: string | null = null;

export function setDeviceToken(tokenId: string | null) {
  deviceToken = tokenId;
}

api.interceptors.request.use((config) => {
  if (deviceToken) config.headers.set(DEVICE_HEADER, deviceToken);
  return config;
});

export type { Incident } from "@servisneinfo/shared";

// mine=true: "Kod mene", samo prekidi čija zona pokriva neku sačuvanu adresu uređaja (R4).
// Uparivanje radi server, a uređaj se prepoznaje po tokenId-u iz headera (KTD1).
export async function fetchIncidents(params?: {
  lat?: number;
  lng?: number;
  type?: Incident["type"];
  mine?: boolean;
}): Promise<Incident[]> {
  // Backend po defaultu vraća samo aktivne — dohvatamo i planirane (kao web)
  const [active, scheduled] = await Promise.all([
    api.get<Incident[]>("/incidents", { params: { ...params, status: "active" } }),
    api.get<Incident[]>("/incidents", { params: { ...params, status: "scheduled" } }),
  ]);
  return [...active.data, ...scheduled.data];
}

// Jedan prekid za ekran detalja; null kad ne postoji (backend vraća 404 i za neispravan ID)
export async function fetchIncident(id: string): Promise<Incident | null> {
  try {
    const { data } = await api.get<Incident>(`/incidents/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

// Nepotvrđene prijave građana (R15): bez imena, kontakta i identifikatora prijavioca
export interface PublicReport {
  id: string;
  type: IncidentType;
  title: string;
  description: string | null;
  address: string;
  municipality: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

// Nepotvrđena prijava ističe nakon 6 sati (KTD10)
export const REPORT_PENDING_HOURS = 6;

export async function fetchPublicReports(): Promise<PublicReport[]> {
  const { data } = await api.get<PublicReport[]>("/reports/public");
  return data;
}

// --- Uređaj (KTD1): registracija radi i bez push tokena ---

export async function registerDevice(payload: { expoToken?: string } = {}): Promise<{ tokenId: string }> {
  const { data } = await api.post<{ tokenId: string }>("/devices/register", payload);
  return data;
}

export async function reportLocation(payload: { lat: number; lng: number }): Promise<void> {
  await api.post("/devices/location", payload);
}

// null = podsjetnik isključen
export type ReminderMinutes = 30 | 60 | 180 | 720 | null;

export interface DeviceSettings {
  locationEnabled: boolean;
  reminderMinutes: ReminderMinutes;
  mutedTypes: IncidentType[];
}

export async function fetchSettings(): Promise<DeviceSettings> {
  const { data } = await api.get<DeviceSettings>("/devices/me/settings");
  return data;
}

export async function updateSettings(patch: Partial<DeviceSettings>): Promise<DeviceSettings> {
  const { data } = await api.patch<DeviceSettings>("/devices/me/settings", patch);
  return data;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

// Backend dozvoljava najviše 5 adresa po uređaju (KTD10)
export const MAX_ADDRESSES = 5;

export async function fetchAddresses(): Promise<SavedAddress[]> {
  const { data } = await api.get<SavedAddress[]>("/devices/me/addresses");
  return data;
}

export async function addAddress(payload: Omit<SavedAddress, "id">): Promise<SavedAddress> {
  const { data } = await api.post<SavedAddress>("/devices/me/addresses", payload);
  return data;
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete(`/devices/me/addresses/${encodeURIComponent(id)}`);
}

export interface AddressMatch {
  label: string;
  lat: number;
  lng: number;
}

// Pretraga adrese u Kantonu Sarajevo (KTD12); 429 kad je pretraga zauzeta ili preko limita
export async function searchAddress(q: string): Promise<AddressMatch[]> {
  const { data } = await api.get<AddressMatch[]>("/geocode", { params: { q } });
  return data;
}

export function isTooManyRequests(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

export function isAddressLimit(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 400
    && /addresses per device/.test(String(err.response?.data?.error ?? ""));
}
