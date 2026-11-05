import axios from "axios";
import Constants from "expo-constants";
import type { Incident } from "@servisneinfo/shared";

// localhost na telefonu je sam telefon — postaviti EXPO_PUBLIC_API_URL
// (LAN IP računara u developmentu, npr. http://192.168.1.10:3000, ili produkcijski URL)
export const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://localhost:3000";

export const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws";

export const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

export type { Incident } from "@servisneinfo/shared";

export async function fetchIncidents(params?: {
  lat?: number;
  lng?: number;
  type?: Incident["type"];
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

export async function registerDevice(payload: {
  expoToken: string;
  lat?: number;
  lng?: number;
}): Promise<{ tokenId: string }> {
  const { data } = await api.post<{ tokenId: string }>("/devices/register", payload);
  return data;
}

export async function reportLocation(payload: {
  tokenId: string;
  lat: number;
  lng: number;
}): Promise<void> {
  await api.post("/devices/location", payload);
}
