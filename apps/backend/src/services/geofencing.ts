import { db } from "../db";
import { notifyIncident } from "./notifications";
import { withdrawnSql } from "../jobs/withdrawn";

// Kad uređaj doda adresu ili javi novu lokaciju (uz uključenu opciju), dobija korak koji
// odgovara statusu prekida u toj zoni: najavu za planiran, početak za aktivan (U4 korak 4).
// Šalje se samo tom uređaju; evidencija po koraku (R12) sprečava ponovno slanje.
export async function notifyDeviceForCurrentIncidents(deviceId: string): Promise<number> {
  const { rows: incidents } = await db.query<{ id: string; status: "scheduled" | "active" }>(
    `SELECT i.id, i.status
       FROM incidents i, device_tokens dt
      WHERE dt.id = $1
        AND i.status IN ('scheduled', 'active')
        AND i.affected_area IS NOT NULL
        AND NOT (i.status = 'scheduled' AND ${withdrawnSql("i")})
        AND (
          EXISTS (SELECT 1 FROM device_addresses da
                   WHERE da.device_id = dt.id AND ST_Intersects(da.location, i.affected_area))
          OR (dt.location_enabled AND dt.last_lat IS NOT NULL
              AND ST_Intersects(ST_SetSRID(ST_MakePoint(dt.last_lng, dt.last_lat), 4326), i.affected_area))
        )`,
    [deviceId]
  );

  let sent = 0;
  for (const incident of incidents) {
    sent += await notifyIncident(incident.id, incident.status === "scheduled" ? "announce" : "start", {
      deviceIds: [deviceId],
    });
  }
  return sent;
}

// Poziva se kad uređaj sa uključenom lokacijom javi novu poziciju (KTD11)
export async function checkLocationAgainstIncidents(tokenId: string, lat: number, lng: number): Promise<void> {
  await db.query(
    `UPDATE device_tokens SET last_lat=$1, last_lng=$2, last_seen_at=NOW() WHERE id=$3`,
    [lat, lng, tokenId]
  );
  await notifyDeviceForCurrentIncidents(tokenId);
}
