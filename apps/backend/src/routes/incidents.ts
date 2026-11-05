import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { DEVICE_HEADER } from "./devices";

const uuid = z.string().uuid();

// id uređaja iz headera ako postoji u bazi, inače null
async function deviceFromHeader(raw: string | string[] | undefined): Promise<string | null> {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !uuid.safeParse(value).success) return null;
  const { rowCount } = await db.query("SELECT 1 FROM device_tokens WHERE id = $1", [value]);
  return rowCount ? value : null;
}

const QuerySchema = z.object({
  lat:    z.coerce.number().optional(),
  lng:    z.coerce.number().optional(),
  type:   z.enum(["water", "electricity", "gas", "heating", "internet"]).optional(),
  status: z.enum(["active", "resolved", "scheduled", "all"]).optional().default("active"),
  limit:  z.coerce.number().min(1).max(200).optional().default(50),
  // Ako je today=true, vraćamo samo incidente čiji starts_at je danas ili u budućnosti
  // z.coerce.boolean() bi i "false" pretvorio u true
  today:  z.enum(["true", "false"]).optional().default("true").transform((v) => v === "true"),
  // "Kod mene" (R4): samo prekidi čija zona pokriva neku sačuvanu adresu uređaja iz headera (KTD1)
  mine:   z.enum(["true", "false"]).optional().default("false").transform((v) => v === "true"),
});

// Incident je "relevantan za danas" ako:
//   - starts_at je danas ili u budućnosti (planirani radovi)
//   - starts_at je NULL (vijesti bez datuma — odbacujemo ih u API-ju)
// Uvijek uključi incidente koji su trenutno aktivni (ends_at > NOW)
const TODAY_FILTER = `(
    -- Aktivan upravo sada (počeo je i još nije završio)
    (starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW()))
    OR
    -- Planirani za danas ili u budućnosti
    (starts_at::date >= CURRENT_DATE)
  )`;

const COLUMNS = `id, type, title, description, source_url,
  affected_addresses, municipality, starts_at, ends_at, status, origin, created_at,
  ST_AsGeoJSON(affected_area) AS area_geojson`;

export async function incidentsRoutes(app: FastifyInstance) {
  app.get("/incidents", async (req, reply) => {
    const query = QuerySchema.parse(req.query);

    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    const where: string[] = [];
    if (query.status !== "all") where.push(`status = ${param(query.status)}`);
    if (query.today) where.push(TODAY_FILTER);
    if (query.type) where.push(`type = ${param(query.type)}`);
    if (query.mine) {
      const deviceId = await deviceFromHeader(req.headers[DEVICE_HEADER]);
      if (!deviceId) return reply.status(404).send({ error: "Unknown device" });
      // Isto uparivanje kao za push (services/notifications.ts)
      where.push(`affected_area IS NOT NULL AND EXISTS (
        SELECT 1 FROM device_addresses da
         WHERE da.device_id = ${param(deviceId)} AND ST_Intersects(da.location, affected_area))`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    if (query.lat !== undefined && query.lng !== undefined) {
      const point = `ST_SetSRID(ST_MakePoint(${param(query.lng)}, ${param(query.lat)}), 4326)::geography`;
      const distance = `ST_Distance(${point}, ST_Centroid(affected_area)::geography)`;
      const sql = `
        SELECT ${COLUMNS}, ${distance} AS distance_meters
        FROM incidents
        ${whereSql}
        ORDER BY CASE WHEN affected_area IS NOT NULL THEN ${distance} ELSE 999999 END ASC
        LIMIT ${param(query.limit)}`;
      const { rows } = await db.query(sql, params);
      return rows.map(r => ({
        ...r,
        area_geojson:    r.area_geojson    ? JSON.parse(r.area_geojson) : null,
        distance_meters: r.distance_meters != null ? Math.round(r.distance_meters) : null,
      }));
    }

    const sql = `
      SELECT ${COLUMNS}
      FROM incidents
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${param(query.limit)}`;
    const { rows } = await db.query(sql, params);
    return rows.map(r => ({
      ...r,
      area_geojson: r.area_geojson ? JSON.parse(r.area_geojson) : null,
      distance_meters: null,
    }));
  });

  // GET /incidents/:id
  app.get<{ Params: { id: string } }>("/incidents/:id", async (req, reply) => {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return reply.status(404).send({ error: "Not found" });
    }
    const { rows } = await db.query(
      `SELECT *, ST_AsGeoJSON(affected_area) AS area_geojson FROM incidents WHERE id=$1`,
      [req.params.id]
    );
    if (rows.length === 0) return reply.status(404).send({ error: "Not found" });
    const row = rows[0];
    return { ...row, area_geojson: row.area_geojson ? JSON.parse(row.area_geojson) : null };
  });
}
