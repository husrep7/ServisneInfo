import axios from "axios";
import { config } from "../config";
import { db } from "../db";

// Rute koje zaobilaze radove (ADR-0005): OSRM vrati do tri alternative, PostGIS provjeri koja
// prolazi kroz zonu aktivnog ili današnjeg planiranog prekida, a preporuka je najbrža ruta
// sa najmanje takvih zona.

export type RouteMode = "car" | "foot";

export interface LineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteWork {
  id:     string;
  type:   string;
  title:  string;
  status: string;
}

export interface RouteOption {
  distance_m:  number;
  duration_s:  number;
  geometry:    LineString;
  works:       RouteWork[];
  recommended: boolean;
}

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: LineString }[];
}

// HTTP poziv prema OSRM-u; testovi ga zamjenjuju
export const osrm = {
  route: async (mode: RouteMode, from: [number, number], to: [number, number]): Promise<OsrmResponse> => {
    const profile = mode === "foot" ? "routed-foot/route/v1/foot" : "routed-car/route/v1/driving";
    const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    const res = await axios.get<OsrmResponse>(`${config.osrmUrl}/${profile}/${coords}`, {
      params: { alternatives: 3, overview: "full", geometries: "geojson", steps: false },
      headers: { "User-Agent": "ServisneInfo/1.0 (info@servisneinfo.ba)" },
      timeout: 15_000,
    });
    return res.data;
  },
};

// Zone koje ruta presijeca (sa 15 m tolerancije za širinu ulice)
async function worksOnRoute(geometry: LineString): Promise<RouteWork[]> {
  const { rows } = await db.query<RouteWork>(
    `SELECT id, type::text, title, status::text FROM incidents
      WHERE affected_area IS NOT NULL
        AND (status = 'active'
          OR (status = 'scheduled' AND (starts_at AT TIME ZONE 'Europe/Sarajevo')::date
                                     = (NOW() AT TIME ZONE 'Europe/Sarajevo')::date))
        AND ST_DWithin(affected_area::geography, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography, 15)
      ORDER BY status, starts_at NULLS LAST
      LIMIT 10`,
    [JSON.stringify(geometry)]
  );
  return rows;
}

export class NoRouteError extends Error {}

export async function planRoutes(mode: RouteMode, from: [number, number], to: [number, number]): Promise<RouteOption[]> {
  const res = await osrm.route(mode, from, to);
  if (res.code !== "Ok" || !res.routes?.length) throw new NoRouteError(res.code);

  const options: RouteOption[] = [];
  for (const r of res.routes.slice(0, 3)) {
    options.push({
      distance_m: Math.round(r.distance),
      duration_s: Math.round(r.duration),
      geometry: r.geometry,
      works: await worksOnRoute(r.geometry),
      recommended: false,
    });
  }
  const best = [...options].sort((a, b) => a.works.length - b.works.length || a.duration_s - b.duration_s)[0];
  best.recommended = true;
  return options;
}
