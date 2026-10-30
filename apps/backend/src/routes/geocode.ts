import { FastifyInstance } from "fastify";
import { z } from "zod";
import { GeocodeBusyError, searchAddresses } from "../services/geocoding";
import { hashIp } from "../services/reports";

const QuerySchema = z.object({ q: z.string().trim().min(3).max(200) });

// Limit po IP hashu (KTD7): najviše 10 pretraga u minuti
export const geocodeRateLimit = { perMinute: 10 };
const recent = new Map<string, number[]>();

function overLimit(ipHash: string): boolean {
  const now = Date.now();
  const list = (recent.get(ipHash) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= geocodeRateLimit.perMinute) {
    recent.set(ipHash, list);
    return true;
  }
  list.push(now);
  recent.set(ipHash, list);
  // Mapa ne smije rasti bez granice
  if (recent.size > 10_000) recent.clear();
  return false;
}

export function resetGeocodeRateLimit(): void {
  recent.clear();
}

export async function geocodeRoutes(app: FastifyInstance) {
  // GET /geocode?q= — pretraga adrese u Kantonu Sarajevo (za dodavanje adrese i pin prijave)
  app.get("/geocode", async (req, reply) => {
    const { q } = QuerySchema.parse(req.query);
    if (overLimit(hashIp(req.ip))) {
      return reply.status(429).send({ error: "Too many searches, try again in a minute" });
    }
    try {
      return await searchAddresses(q);
    } catch (err) {
      if (err instanceof GeocodeBusyError) {
        return reply.status(429).send({ error: "Address search is busy, try again" });
      }
      req.log.warn(`geocode failed: ${err}`);
      return reply.status(502).send({ error: "Address search failed" });
    }
  });
}
