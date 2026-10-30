import { db } from "../db";
import { notifyIncident } from "./notifications";

// Poziva se kad uređaj sa uključenom lokacijom javi novu poziciju (KTD11).
// Za aktivne prekide čija zona sadrži tu poziciju šalje korak "početak" samo tom uređaju;
// evidencija po koraku (R12) sprečava ponovno slanje.
export async function checkLocationAgainstIncidents(
  tokenId: string,
  lat: number,
  lng: number
): Promise<void> {
  await db.query(
    `UPDATE device_tokens SET last_lat=$1, last_lng=$2, last_seen_at=NOW() WHERE id=$3`,
    [lat, lng, tokenId]
  );

  const { rows: incidents } = await db.query<{ id: string }>(
    `SELECT i.id
     FROM incidents i
     WHERE i.status = 'active'
       AND i.affected_area IS NOT NULL
       AND ST_Intersects(ST_SetSRID(ST_MakePoint($1, $2), 4326), i.affected_area)
       AND NOT EXISTS (
         SELECT 1 FROM sent_notifications sn
         WHERE sn.incident_id = i.id AND sn.token_id = $3 AND sn.step = 'start'
       )`,
    [lng, lat, tokenId]
  );

  for (const incident of incidents) {
    await notifyIncident(incident.id, "start", tokenId);
  }
}
