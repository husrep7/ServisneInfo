import cron from 'node-cron';
import { db } from '../db';

async function updateStatuses(): Promise<void> {
  // 1. Zatvori incidente kojima je ends_at prošlo (EPBiH isključenja)
  const { rowCount: r1 } = await db.query(`
    UPDATE incidents SET status = 'resolved', updated_at = NOW()
    WHERE ends_at IS NOT NULL
      AND ends_at < NOW()
      AND status != 'resolved'
  `);

  // 2. Zatvori incidente bez ends_at koji danas više nisu objavljeni na izvoru
  //    Pravilo: obavijest je aktivna dok god je scraper vidi (last_seen_at)
  //    Vrijedi za: Sarajevogas, ViK obavijesti, Toplane i sl.
  //    Planirani incidenti (scheduled) se ne diraju — prvo moraju početi
  const { rowCount: r2 } = await db.query(`
    UPDATE incidents SET status = 'resolved', updated_at = NOW()
    WHERE ends_at IS NULL
      AND (last_seen_at AT TIME ZONE 'Europe/Sarajevo')::date
          < (NOW() AT TIME ZONE 'Europe/Sarajevo')::date
      AND status = 'active'
  `);

  // 3. Aktiviraj scheduled incidente čiji je starts_at nastupio
  const { rowCount: r3 } = await db.query(`
    UPDATE incidents SET status = 'active', updated_at = NOW()
    WHERE status = 'scheduled'
      AND starts_at <= NOW()
      AND (ends_at IS NULL OR ends_at >= NOW())
  `);

  // 4. Prebaci u scheduled ako je starts_at u budućnosti (korekcija)
  const { rowCount: r4 } = await db.query(`
    UPDATE incidents SET status = 'scheduled', updated_at = NOW()
    WHERE status = 'active'
      AND starts_at IS NOT NULL
      AND starts_at > NOW()
  `);

  const total = (r1 ?? 0) + (r2 ?? 0) + (r3 ?? 0) + (r4 ?? 0);
  if (total > 0) {
    console.log(`[Status job] resolved=${(r1??0)+(r2??0)}, activated=${r3??0}, scheduled=${r4??0}`);
  }
}

export function startStatusJob(): void {
  updateStatuses().catch(console.error);

  cron.schedule('*/5 * * * *', () => {
    updateStatuses().catch(console.error);
  });

  console.log('✅ Status job scheduled every 5 minutes');
}
