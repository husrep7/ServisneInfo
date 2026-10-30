import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../db";
import { checkLocationAgainstIncidents } from "../services/geofencing";

// tokenId ide samo u headeru, nikad u URL-u, jer Fastify loguje URL-ove (KTD1)
export const DEVICE_HEADER = "x-device-token";
export const MAX_ADDRESSES = 5;

const INCIDENT_TYPES = ["water", "electricity", "gas", "heating", "internet"] as const;

const RegisterSchema = z.object({
  expoToken: z.string().min(10).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const LocationSchema = z.object({
  // Stara mobilna verzija šalje tokenId u tijelu; nove ga šalju u headeru
  tokenId: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const SettingsSchema = z.object({
  locationEnabled: z.boolean().optional(),
  // null = podsjetnik isključen
  reminderMinutes: z.union([z.literal(30), z.literal(60), z.literal(180), z.literal(720), z.null()]).optional(),
  mutedTypes: z.array(z.enum(INCIDENT_TYPES)).max(5).optional(),
}).strict();

const AddressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const uuid = z.string().uuid();

function headerToken(req: FastifyRequest): string | null {
  const raw = req.headers[DEVICE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && uuid.safeParse(value).success ? value : null;
}

// Vraća id uređaja iz headera ili šalje 404
async function requireDevice(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const id = headerToken(req);
  if (id) {
    const { rowCount } = await db.query("SELECT 1 FROM device_tokens WHERE id = $1", [id]);
    if (rowCount) return id;
  }
  reply.status(404).send({ error: "Unknown device" });
  return null;
}

// pg ne parsira niz enum vrijednosti (incident_type[]), pa ga upiti vraćaju kao text[]
interface SettingsRow {
  location_enabled: boolean;
  reminder_minutes: number | null;
  muted_types: string[];
}

const toSettings = (r: SettingsRow) => ({
  locationEnabled: r.location_enabled,
  reminderMinutes: r.reminder_minutes,
  mutedTypes: r.muted_types,
});

export async function devicesRoutes(app: FastifyInstance) {
  // POST /devices/register — radi i bez push tokena; sa postojećim tokenId-em veže/mijenja Expo token (KTD1)
  app.post("/devices/register", async (req, reply) => {
    const body = RegisterSchema.parse(req.body ?? {});
    const existing = headerToken(req);
    const client = await db.connect();
    let tokenId: string;
    try {
      await client.query("BEGIN");
      let row: { id: string } | undefined;
      if (existing) {
        ({ rows: [row] } = await client.query<{ id: string }>(
          "SELECT id FROM device_tokens WHERE id = $1 FOR UPDATE", [existing]
        ));
      }
      if (!row && body.expoToken) {
        // Stara verzija bez tokenId-a: isti Expo token = isti uređaj
        ({ rows: [row] } = await client.query<{ id: string }>(
          "SELECT id FROM device_tokens WHERE expo_token = $1 FOR UPDATE", [body.expoToken]
        ));
      }
      if (!row) {
        ({ rows: [row] } = await client.query<{ id: string }>(
          "INSERT INTO device_tokens DEFAULT VALUES RETURNING id"
        ));
      }
      if (body.expoToken) {
        // Expo token pripada jednom uređaju: skini ga sa drugog reda prije vezivanja
        await client.query(
          "UPDATE device_tokens SET expo_token = NULL WHERE expo_token = $1 AND id <> $2",
          [body.expoToken, row.id]
        );
        await client.query("UPDATE device_tokens SET expo_token = $1 WHERE id = $2", [body.expoToken, row.id]);
      }
      await client.query("UPDATE device_tokens SET last_seen_at = NOW() WHERE id = $1", [row.id]);
      await client.query("COMMIT");
      tokenId = row.id;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Lokacija se gleda samo kad ju je korisnik uključio (KTD11)
    if (body.lat !== undefined && body.lng !== undefined) {
      await updateLocation(tokenId, body.lat, body.lng);
    }
    return reply.status(201).send({ tokenId });
  });

  // POST /devices/location — značajna promjena lokacije
  app.post("/devices/location", async (req, reply) => {
    const body = LocationSchema.parse(req.body);
    const id = headerToken(req) ?? body.tokenId;
    if (!id) return reply.status(404).send({ error: "Unknown device" });
    const used = await updateLocation(id, body.lat, body.lng);
    if (used === null) return reply.status(404).send({ error: "Unknown device" });
    return { ok: true, used };
  });

  app.get("/devices/me/settings", async (req, reply) => {
    const id = await requireDevice(req, reply);
    if (!id) return;
    const { rows: [r] } = await db.query<SettingsRow>(
      "SELECT location_enabled, reminder_minutes, muted_types::text[] AS muted_types FROM device_tokens WHERE id = $1", [id]
    );
    return toSettings(r);
  });

  app.patch("/devices/me/settings", async (req, reply) => {
    const id = await requireDevice(req, reply);
    if (!id) return;
    const body = SettingsSchema.parse(req.body ?? {});
    const { rows: [r] } = await db.query<SettingsRow>(
      `UPDATE device_tokens SET
         location_enabled = COALESCE($2, location_enabled),
         reminder_minutes = CASE WHEN $3 THEN $4::int ELSE reminder_minutes END,
         muted_types      = COALESCE($5::incident_type[], muted_types),
         -- Isključena lokacija briše zadnju poznatu lokaciju (KTD11)
         last_lat = CASE WHEN $2 IS FALSE THEN NULL ELSE last_lat END,
         last_lng = CASE WHEN $2 IS FALSE THEN NULL ELSE last_lng END
       WHERE id = $1
       RETURNING location_enabled, reminder_minutes, muted_types::text[] AS muted_types`,
      [id, body.locationEnabled ?? null, body.reminderMinutes !== undefined,
       body.reminderMinutes ?? null, body.mutedTypes ?? null]
    );
    return toSettings(r);
  });

  app.get("/devices/me/addresses", async (req, reply) => {
    const id = await requireDevice(req, reply);
    if (!id) return;
    const { rows } = await db.query(
      `SELECT id, label, address, ST_Y(location) AS lat, ST_X(location) AS lng, created_at
         FROM device_addresses WHERE device_id = $1 ORDER BY created_at`,
      [id]
    );
    return rows;
  });

  app.post("/devices/me/addresses", async (req, reply) => {
    const id = await requireDevice(req, reply);
    if (!id) return;
    const body = AddressSchema.parse(req.body);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Zaključaj uređaj da dvije istovremene šeste adrese ne prođu limit (KTD10)
      await client.query("SELECT 1 FROM device_tokens WHERE id = $1 FOR UPDATE", [id]);
      const { rows: [{ n }] } = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM device_addresses WHERE device_id = $1", [id]
      );
      if (n >= MAX_ADDRESSES) {
        await client.query("ROLLBACK");
        return reply.status(400).send({ error: `At most ${MAX_ADDRESSES} addresses per device` });
      }
      const { rows: [row] } = await client.query(
        `INSERT INTO device_addresses (device_id, label, address, location)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326))
         RETURNING id, label, address, ST_Y(location) AS lat, ST_X(location) AS lng, created_at`,
        [id, body.label, body.address, body.lat, body.lng]
      );
      await client.query("COMMIT");
      return reply.status(201).send(row);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  app.delete<{ Params: { addressId: string } }>("/devices/me/addresses/:addressId", async (req, reply) => {
    const id = await requireDevice(req, reply);
    if (!id) return;
    if (!uuid.safeParse(req.params.addressId).success) return reply.status(404).send({ error: "Not found" });
    const { rowCount } = await db.query(
      "DELETE FROM device_addresses WHERE id = $1 AND device_id = $2", [req.params.addressId, id]
    );
    return rowCount ? reply.status(204).send() : reply.status(404).send({ error: "Not found" });
  });
}

// null = nepoznat uređaj; false = lokacija isključena, pa je ignorisana; true = sačuvana i provjerena
async function updateLocation(id: string, lat: number, lng: number): Promise<boolean | null> {
  const { rows: [d] } = await db.query<{ location_enabled: boolean }>(
    "SELECT location_enabled FROM device_tokens WHERE id = $1", [id]
  );
  if (!d) return null;
  if (!d.location_enabled) return false;
  await checkLocationAgainstIncidents(id, lat, lng);
  return true;
}
