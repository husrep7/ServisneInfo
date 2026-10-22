import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";

const QuerySchema = z.object({
  lat:    z.coerce.number().optional(),
  lng:    z.coerce.number().optional(),
  type:   z.enum(["water", "electricity", "gas", "heating", "internet"]).optional(),
  status: z.enum(["active", "resolved", "scheduled", "all"]).optional().default("active"),
  limit:  z.coerce.number().min(1).max(200).optional().default(50),
  // Ako je today=true, vraćamo samo incidente čiji starts_at je danas ili u budućnosti
  today:  z.coerce.boolean().optional().default(true),
});

// Incident je "relevantan za danas" ako:
//   - starts_at je danas ili u budućnosti (planirani radovi)
//   - starts_at je NULL (vijesti bez datuma — odbacujemo ih u API-ju)
// Uvijek uključi incidente koji su trenutno aktivni (ends_at > NOW)
const TODAY_FILTER = `
  AND (
    -- Aktivan upravo sada (počeo je i još nije završio)
    (starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW()))
    OR
    -- Planirani za danas ili u budućnosti
    (starts_at::date >= CURRENT_DATE)
  )
`;

export async function incidentsRoutes(app: FastifyInstance) {
  app.get("/incidents", async (req) => {
    const query = QuerySchema.parse(req.query);

    const statusFilter = query.status === "all" ? "" : "AND status = $1";
    const todayFilter  = query.today ? TODAY_FILTER : "";
    const typeFilter   = query.type  ? `AND type = $${query.status === "all" ? 1 : 2}` : "";

    // Build params — status always first if used
    const buildParams = (...extra: unknown[]) =>
      query.status === "all"
        ? [...extra]
        : [query.status, ...extra];

    if (query.lat !== undefined && query.lng !== undefined) {
      const p = buildParams(query.lng, query.lat, query.limit, ...(query.type ? [query.type] : []));
      const typeIdx  = query.type  ? `AND type = $${p.length}` : "";
      const limitIdx = p.indexOf(query.limit) + 1;
      const sql = `
        SELECT id, type, title, description, source_url,
               affected_addresses, municipality, starts_at, ends_at, status, created_at,
               ST_AsGeoJSON(affected_area) AS area_geojson,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($${buildParams(query.lng).length}, $${buildParams(query.lng, query.lat).length}), 4326)::geography,
                 ST_Centroid(affected_area)::geography
               ) AS distance_meters
        FROM incidents
        WHERE 1=1 ${statusFilter} ${todayFilter} ${typeIdx}
        ORDER BY CASE WHEN affected_area IS NOT NULL
          THEN ST_Distance(ST_SetSRID(ST_MakePoint($${buildParams(query.lng).length}, $${buildParams(query.lng,query.lat).length}), 4326)::geography, ST_Centroid(affected_area)::geography)
          ELSE 999999 END ASC
        LIMIT $${limitIdx}`;
      const { rows } = await db.query(sql, p);
      return rows.map(r => ({
        ...r,
        area_geojson:    r.area_geojson    ? JSON.parse(r.area_geojson) : null,
        distance_meters: r.distance_meters ? Math.round(r.distance_meters) : null,
      }));
    }

    // Simple query without geo
    const extraParams: unknown[] = [];
    if (query.type) extraParams.push(query.type);
    extraParams.push(query.limit);

    const allParams = buildParams(...extraParams);
    const limitPlaceholder = `$${allParams.length}`;
    const typePlaceholder  = query.type ? `AND type = $${allParams.indexOf(query.type) + 1}` : "";

    const sql = `
      SELECT id, type, title, description, source_url,
             affected_addresses, municipality, starts_at, ends_at, status, created_at,
             ST_AsGeoJSON(affected_area) AS area_geojson
      FROM incidents
      WHERE 1=1 ${statusFilter} ${todayFilter} ${typePlaceholder}
      ORDER BY created_at DESC
      LIMIT ${limitPlaceholder}`;

    const { rows } = await db.query(sql, allParams);
    return rows.map(r => ({
      ...r,
      area_geojson: r.area_geojson ? JSON.parse(r.area_geojson) : null,
      distance_meters: null,
    }));
  });

  // GET /incidents/:id
  app.get<{ Params: { id: string } }>("/incidents/:id", async (req, reply) => {
    const { rows } = await db.query(
      `SELECT *, ST_AsGeoJSON(affected_area) AS area_geojson FROM incidents WHERE id=$1`,
      [req.params.id]
    );
    if (rows.length === 0) return reply.status(404).send({ error: "Not found" });
    const row = rows[0];
    return { ...row, area_geojson: row.area_geojson ? JSON.parse(row.area_geojson) : null };
  });
}
