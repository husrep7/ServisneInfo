import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { AddressMatch, GeocodeBusyError, reverseGeocode, searchAddresses } from "../services/geocoding";
import { PLACE_CATEGORIES, nearbyPlaces } from "../services/places";
import { lookupPlace } from "../services/gazetteer";
import { NoRouteError, planRoutes } from "../services/routing";
import { parseQuery } from "../services/search";
import { createLimiter } from "../services/rateLimit";
import { hashIp } from "../services/reports";

// Lokacija korisnika (ADR-0004, ADR-0005): šta je oko mene, objekti u blizini, pametna
// pretraga i rute oko radova. Sve je ograničeno na šire područje Kantona Sarajevo.

const lat = z.coerce.number().min(43.55).max(44.15);
const lng = z.coerce.number().min(17.95).max(18.75);
const OUTSIDE = "Lokacija je izvan Kantona Sarajevo";

const NearbySchema = z.object({ lat, lng, radius: z.coerce.number().int().min(200).max(3000).default(1500) });
const PlacesSchema = z.object({
  lat, lng,
  category: z.enum(PLACE_CATEGORIES),
  radius: z.coerce.number().int().min(200).max(5000).default(2000),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
const SearchSchema = z.object({ q: z.string().trim().min(2).max(200), lat: lat.optional(), lng: lng.optional() });
const point = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).transform((s) => s.split(",").map(Number) as [number, number]);
const RouteSchema = z.object({ from: point, to: point, mode: z.enum(["car", "foot"]).default("car") });

const inRegion = ([la, ln]: [number, number]) => lat.safeParse(la).success && lng.safeParse(ln).success;

// Upiti prema vanjskim servisima (Nominatim, Overpass, OSRM) po IP hashu
export const locationLimits = {
  places: createLimiter({ max: 40, windowMs: 60_000 }),
  search: createLimiter({ max: 15, windowMs: 60_000 }),
  route:  createLimiter({ max: 10, windowMs: 60_000 }),
};

function limited(req: FastifyRequest, reply: FastifyReply, limiter: ReturnType<typeof createLimiter>): boolean {
  if (!limiter.limited(hashIp(req.ip))) return false;
  reply.status(429).send({ error: "Previše zahtjeva, pokušajte ponovo za minut" });
  return true;
}

// Prekidi oko tačke: inside = tačka je u zoni, inače udaljenost do ruba zone
async function incidentsAround(la: number, ln: number, radius: number) {
  const { rows } = await db.query(
    `SELECT id, type, title, status, starts_at, ends_at, affected_addresses, origin, source_url,
            ST_AsGeoJSON(affected_area) AS area_geojson,
            ST_Contains(affected_area, p.pt) AS inside,
            ROUND(ST_Distance(affected_area::geography, p.pt::geography)) AS distance_meters
       FROM incidents, (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS pt) p
      WHERE status IN ('active', 'scheduled')
        AND affected_area IS NOT NULL
        AND (ends_at IS NULL OR ends_at > NOW())
        AND ST_DWithin(affected_area::geography, p.pt::geography, $3)
      ORDER BY inside DESC, distance_meters ASC, status ASC
      LIMIT 30`,
    [ln, la, radius]
  );
  return rows.map((r) => ({
    ...r,
    area_geojson: r.area_geojson ? JSON.parse(r.area_geojson) : null,
    distance_meters: Number(r.distance_meters),
  }));
}

// Mjesto iz pretrage: prvo lokalni registar ulica i naselja (razumije padeže), pa Nominatim
// sa nominativom ("kod Ferhadije" → "Ferhadija")
async function geocodePlace(place: string, near?: { lat: number; lng: number }): Promise<AddressMatch | null> {
  const local = await lookupPlace(place, near);
  if (local) return local;
  const variants = [place];
  const nominative = place.replace(/(\p{L}{3,})e(?!\p{L})/gu, "$1a");
  if (nominative !== place) variants.push(nominative);
  for (const v of variants) {
    const [first] = await searchAddresses(v);
    if (first) return first;
  }
  return null;
}

function busy(reply: FastifyReply, err: unknown, req: FastifyRequest) {
  if (err instanceof GeocodeBusyError) return reply.status(429).send({ error: "Pretraga adresa je zauzeta, pokušajte ponovo" });
  req.log.warn(`location lookup failed: ${err}`);
  return reply.status(502).send({ error: "Vanjski servis trenutno ne odgovara" });
}

export async function locationRoutes(app: FastifyInstance) {
  // GET /nearby?lat&lng — "šta je oko mene": adresa + prekidi u mojoj ulici i blizini
  app.get("/nearby", async (req, reply) => {
    const parsed = NearbySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: OUTSIDE });
    const q = parsed.data;
    const [incidents, address] = await Promise.all([
      incidentsAround(q.lat, q.lng, q.radius),
      // Adresa je dodatak; ako Nominatim ne odgovori, prekidi se i dalje vraćaju
      reverseGeocode(q.lat, q.lng).catch(() => null),
    ]);
    return { address, incidents };
  });

  // GET /places/nearby?lat&lng&category=atm|fuel|post|pharmacy|bank
  app.get("/places/nearby", async (req, reply) => {
    const parsed = PlacesSchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: "Neispravna lokacija ili kategorija" });
    if (limited(req, reply, locationLimits.places)) return;
    const q = parsed.data;
    try {
      return await nearbyPlaces(q.category, q.lat, q.lng, q.radius, q.limit);
    } catch (err) {
      return busy(reply, err, req);
    }
  });

  // GET /search?q=bankomat kod Ferhadije[&lat&lng] — objekti oko mjesta iz upita ili oko korisnika;
  // upit bez kategorije je pretraga adrese
  app.get("/search", async (req, reply) => {
    const parsed = SearchSchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: "Neispravan upit" });
    if (limited(req, reply, locationLimits.search)) return;
    const q = parsed.data;
    try {
      const intent = await parseQuery(q.q);
      if (!intent.category) {
        const addresses = await searchAddresses(q.q);
        return { kind: "address", query: intent, addresses };
      }
      let center: { label: string; lat: number; lng: number } | null = null;
      const near = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
      if (intent.place) center = await geocodePlace(intent.place, near);
      else if (q.lat !== undefined && q.lng !== undefined) center = { label: "Vaša lokacija", lat: q.lat, lng: q.lng };
      if (!center) {
        return reply.status(404).send({
          error: intent.place ? `Nismo pronašli "${intent.place}" u Kantonu Sarajevo` : "Uključite lokaciju ili upišite ulicu",
          query: intent,
        });
      }
      const places = await nearbyPlaces(intent.category, center.lat, center.lng, 2000, 10);
      return { kind: "places", query: intent, center, places };
    } catch (err) {
      return busy(reply, err, req);
    }
  });

  // GET /route?from=lat,lng&to=lat,lng&mode=car|foot — alternative rute i radovi na svakoj
  app.get("/route", async (req, reply) => {
    const parsed = RouteSchema.safeParse(req.query);
    if (!parsed.success || !inRegion(parsed.data.from) || !inRegion(parsed.data.to)) {
      return reply.status(400).send({ error: OUTSIDE });
    }
    if (limited(req, reply, locationLimits.route)) return;
    const q = parsed.data;
    try {
      return { routes: await planRoutes(q.mode, q.from, q.to) };
    } catch (err) {
      if (err instanceof NoRouteError) return reply.status(404).send({ error: "Ruta nije pronađena" });
      return busy(reply, err, req);
    }
  });
}
