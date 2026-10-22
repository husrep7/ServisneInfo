import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { checkLocationAgainstIncidents } from "../services/geofencing";

const RegisterSchema = z.object({
  expoToken: z.string().min(10),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const LocationSchema = z.object({
  tokenId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
});

export async function devicesRoutes(app: FastifyInstance) {
  // POST /devices/register — register a push token (called on app startup)
  app.post("/devices/register", async (req, reply) => {
    const body = RegisterSchema.parse(req.body);

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO device_tokens (expo_token, last_lat, last_lng)
       VALUES ($1, $2, $3)
       ON CONFLICT (expo_token) DO UPDATE
         SET last_lat = EXCLUDED.last_lat,
             last_lng = EXCLUDED.last_lng,
             last_seen_at = NOW()
       RETURNING id`,
      [body.expoToken, body.lat ?? null, body.lng ?? null]
    );

    const tokenId = rows[0].id;

    // Immediately check geofencing if location was provided
    if (body.lat !== undefined && body.lng !== undefined) {
      await checkLocationAgainstIncidents(tokenId, body.lat, body.lng);
    }

    return reply.status(201).send({ tokenId });
  });

  // POST /devices/location — device reports significant location change
  app.post("/devices/location", async (req, reply) => {
    const body = LocationSchema.parse(req.body);
    await checkLocationAgainstIncidents(body.tokenId, body.lat, body.lng);
    return { ok: true };
  });
}
