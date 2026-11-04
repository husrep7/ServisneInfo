import cron from 'node-cron';
import { db } from '../db';
import { buildPolygonFromAddresses, parseAddressesFromText, zoneFromPointsSql } from '../services/geocoding';
import { incidentEffects } from '../scrapers/base';

// Obavijesti koje su ušle bez zone (npr. dok izvlačenje adresa nije radilo) dobijaju zonu
// naknadno. Svaka se pokušava jednom (geocode_attempted_at); Nominatim red je 1 zahtjev/s,
// pa je krug ograničen na nekoliko obavijesti.
// Dok red radi, pretrage adresa korisnika dobijaju 429, pa krug mora biti kratak.
const BATCH = 3;

export async function backfillIncidentAreas(limit = BATCH): Promise<number> {
  const { rows } = await db.query<{ id: string; title: string; description: string | null; status: string }>(
    `UPDATE incidents SET geocode_attempted_at = NOW()
      WHERE id IN (
        SELECT id FROM incidents
         WHERE affected_area IS NULL AND geocode_attempted_at IS NULL
           AND status <> 'resolved'
         ORDER BY created_at DESC
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING id, title, description, status`,
    [limit]
  );

  let filled = 0;
  for (const row of rows) {
    try {
      const addresses = await parseAddressesFromText(row.description || row.title);
      const wkt = await buildPolygonFromAddresses(addresses);
      if (!wkt) continue;
      await db.query(
        `UPDATE incidents
            SET affected_addresses = $2,
                affected_area = ${zoneFromPointsSql('$3')},
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, addresses, wkt]
      );
      filled++;
      // Bez zone niko nije bio obaviješten; sent_notifications sprečava duplikate
      await incidentEffects.notify(row.id, row.status === 'scheduled' ? 'announce' : 'start').catch((err) =>
        console.error(`[backfill] notify failed: ${err}`)
      );
    } catch (err) {
      console.warn(`[backfill] ${row.id}: ${err}`);
    }
  }
  if (rows.length > 0) console.log(`[backfill] zone: ${filled}/${rows.length}`);
  return filled;
}

let running = false;

export function startBackfillJob(): { stop: () => void } {
  const run = async () => {
    if (running) return;
    running = true;
    try { await backfillIncidentAreas(); }
    catch (err) { console.error('[backfill] failed:', err); }
    finally { running = false; }
  };
  void run();
  const task = cron.schedule('*/5 * * * *', run);
  console.log('✅ Backfill job (zone obavijesti) scheduled every 5 minutes');
  return task;
}
