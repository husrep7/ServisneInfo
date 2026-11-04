import cron from 'node-cron';
import { db } from '../db';

// Rokovi čuvanja ličnih podataka (#26). Moraju se slagati sa politikom privatnosti na webu (/privatnost).
export const RETENTION = {
  locationDays:       90, // zadnja lokacija uređaja koji se toliko dugo nije javio
  reportContactDays:  7,  // ime i kontakt iz prijave (prijava je tada odavno obrađena ili istekla)
  reportIpHashDays:   30, // hash IP adrese prijavioca
};

export async function applyRetention(now: Date = new Date()): Promise<{ locations: number; contacts: number; ipHashes: number }> {
  const { rowCount: locations } = await db.query(
    `UPDATE device_tokens SET last_lat = NULL, last_lng = NULL
      WHERE last_lat IS NOT NULL
        AND last_seen_at < $1::timestamptz - make_interval(days => $2)`,
    [now, RETENTION.locationDays]
  );
  // Prijava na čekanju ističe za 6 h, pa je svaka prijava starija od 7 dana već obrađena
  const { rowCount: contacts } = await db.query(
    `UPDATE reports SET reporter_name = NULL, contact = NULL
      WHERE (reporter_name IS NOT NULL OR contact IS NOT NULL)
        AND status <> 'pending'
        AND created_at < $1::timestamptz - make_interval(days => $2)`,
    [now, RETENTION.reportContactDays]
  );
  const { rowCount: ipHashes } = await db.query(
    `UPDATE reports SET ip_hash = NULL
      WHERE ip_hash IS NOT NULL
        AND created_at < $1::timestamptz - make_interval(days => $2)`,
    [now, RETENTION.reportIpHashDays]
  );
  const result = { locations: locations ?? 0, contacts: contacts ?? 0, ipHashes: ipHashes ?? 0 };
  if (result.locations + result.contacts + result.ipHashes > 0) {
    console.log(`[Retention] locations=${result.locations}, contacts=${result.contacts}, ipHashes=${result.ipHashes}`);
  }
  return result;
}

export function startRetentionJob(): cron.ScheduledTask {
  // Jednom dnevno u 03:30 po sarajevskom vremenu
  const task = cron.schedule('30 3 * * *', () => {
    applyRetention().catch(console.error);
  }, { timezone: 'Europe/Sarajevo' });
  console.log('✅ Retention job scheduled daily at 03:30');
  return task;
}
