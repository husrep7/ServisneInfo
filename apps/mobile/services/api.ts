import axios from "axios";
import Constants from "expo-constants";

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000";

export const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

export interface Incident {
  id: string;
  type: "water" | "electricity" | "gas" | "heating" | "internet";
  title: string;
  description: string | null;
  source_url: string | null;
  affected_addresses: string[] | null;
  municipality: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "resolved" | "scheduled";
  created_at: string;
  area_geojson: GeoJSON.Polygon | null;
  distance_meters: number | null;
}

export async function fetchIncidents(params?: {
  lat?: number;
  lng?: number;
  type?: Incident["type"];
}): Promise<Incident[]> {
  const { data } = await api.get<Incident[]>("/incidents", { params });
  return data;
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
