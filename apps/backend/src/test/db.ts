import { db } from '../db';
import { runMigrations } from '../db/migrate';

// Testovi nad bazom traže PostGIS (CI ga ima kao servis). Bez DATABASE_URL se preskaču.
export const skipWithoutDb = process.env.DATABASE_URL ? false : 'DATABASE_URL nije postavljen (treba PostGIS baza)';

let migrated = false;

export async function resetDb(): Promise<void> {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  await db.query('TRUNCATE reports, blocked_reporters, sent_notifications, device_tokens, incidents CASCADE');
}

export async function closeDb(): Promise<void> {
  await db.end();
}
