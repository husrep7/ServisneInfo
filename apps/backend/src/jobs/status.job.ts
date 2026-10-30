import cron from 'node-cron';
import { db } from '../db';
import { REPORT_RULES } from '../services/reports';

// `now` je parametar da bi testovi mogli provjeriti pravila oko ponoći
export async function updateStatuses(now: Date = new Date()): Promise<void> {
  // 1. Zatvori incidente kojima je ends_at prošlo (EPBiH isključenja)
  const { rowCount: r1 } = await db.query(`
    UPDATE incidents SET status = 'resolved', updated_at = NOW()
    WHERE ends_at IS NOT NULL
      AND ends_at < $1
      AND status != 'resolved'
  `, [now]);

  // 2. Zatvori incidente bez ends_at koji danas više nisu objavljeni na izvoru
  //    Pravilo: obavijest je aktivna dok god je scraper vidi (last_seen_at)
  //    Vrijedi za: Sarajevogas, ViK obavijesti, Toplane i sl.
  //    Planirani incidenti (scheduled) se ne diraju — prvo moraju početi
  //    Korisnički prekidi imaju svoje pravilo (6.), pa se ovdje ne zatvaraju u ponoć
  const { rowCount: r2 } = await db.query(`
    UPDATE incidents SET status = 'resolved', updated_at = NOW()
    WHERE ends_at IS NULL
      AND origin = 'official'
      AND (last_seen_at AT TIME ZONE 'Europe/Sarajevo')::date
          < ($1::timestamptz AT TIME ZONE 'Europe/Sarajevo')::date
      AND status = 'active'
  `, [now]);

  // 3. Aktiviraj scheduled incidente čiji je starts_at nastupio
  const { rowCount: r3 } = await db.query(`
    UPDATE incidents SET status = 'active', updated_at = NOW()
    WHERE status = 'scheduled'
      AND starts_at <= $1
      AND (ends_at IS NULL OR ends_at >= $1)
  `, [now]);

  // 4. Prebaci u scheduled ako je starts_at u budućnosti (korekcija)
  const { rowCount: r4 } = await db.query(`
    UPDATE incidents SET status = 'scheduled', updated_at = NOW()
    WHERE status = 'active'
      AND starts_at IS NOT NULL
      AND starts_at > $1
  `, [now]);

  // 5. Nepotvrđene prijave ističu nakon 6 sati (KTD10)
  const { rowCount: r5 } = await db.query(`
    UPDATE reports SET status = 'expired'
    WHERE status = 'pending'
      AND created_at < $1::timestamptz - make_interval(hours => $2)
  `, [now, REPORT_RULES.pendingHours]);

  // 6. Korisnički prekid se zatvara 6 sati nakon zadnje prijave koja ga podržava (KTD5)
  const { rowCount: r6 } = await db.query(`
    UPDATE incidents SET status = 'resolved', updated_at = NOW()
    WHERE origin = 'user'
      AND status = 'active'
      AND last_seen_at < $1::timestamptz - make_interval(hours => $2)
  `, [now, REPORT_RULES.userIncidentHours]);

  const total = (r1 ?? 0) + (r2 ?? 0) + (r3 ?? 0) + (r4 ?? 0) + (r5 ?? 0) + (r6 ?? 0);
  if (total > 0) {
    console.log(`[Status job] resolved=${(r1??0)+(r2??0)+(r6??0)}, activated=${r3??0}, scheduled=${r4??0}, reports expired=${r5??0}`);
  }
}

export function startStatusJob(): void {
  updateStatuses().catch(console.error);

  cron.schedule('*/5 * * * *', () => {
    updateStatuses().catch(console.error);
  });

  console.log('✅ Status job scheduled every 5 minutes');
}
