// Oblik podataka koji backend vraća na /incidents.
// Samo tipovi: uvoziti sa `import type`, pa paket ne postoji u runtime-u
// (Vite, Metro i tsc ga brišu pri kompilaciji).

export type IncidentType = 'water' | 'electricity' | 'gas' | 'heating' | 'internet';
export type IncidentStatus = 'active' | 'resolved' | 'scheduled';

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

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
  area_geojson: PolygonGeometry | null;
  distance_meters: number | null;
}
