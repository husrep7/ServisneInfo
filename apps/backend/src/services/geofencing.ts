import { db } from "../db";
import { notifyDevicesInArea } from "./notifications";

// Called when a device reports a new location.
// Finds all active incidents that contain the device's new position
// and triggers notifications for any unseen ones.
export async function checkLocationAgainstIncidents(
  tokenId: string,
  lat: number,
  lng: number
): Promise<void> {
  await db.query(
    `UPDATE device_tokens SET last_lat=$1, last_lng=$2, last_seen_at=NOW() WHERE id=$3`,
    [lat, lng, tokenId]
  );

  const { rows: incidents } = await db.query<{
    id: string;
    type: string;
    title: string;
    description: string | null;
  }>(
    `SELECT i.id, i.type, i.title, i.description
     FROM incidents i
     WHERE i.status = 'active'
       AND i.affected_area IS NOT NULL
       AND ST_Within(
         ST_SetSRID(ST_MakePoint($1, $2), 4326),
         i.affected_area
       )
       AND NOT EXISTS (
         SELECT 1 FROM sent_notifications sn
         WHERE sn.incident_id = i.id AND sn.token_id = $3
       )`,
    [lng, lat, tokenId]
  );

  for (const incident of incidents) {
    await notifyDevicesInArea(incident);
  }
}
