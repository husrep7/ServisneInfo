import cron from 'node-cron';
import { importPlaces, placesStatus } from '../services/places';
import { importGazetteer } from '../services/gazetteer';
import { db } from '../db';

// Dnevni uvoz iz OpenStreetMapa (ADR-0004): objekti (places) i registar ulica i naselja
// (gazetteer). Na startu se uvozi samo ono što je prazno ili starije od dana; neuspjeli uvoz
// se ponavlja svaki sat dok ne uspije.
const MAX_AGE_MS = 24 * 3600e3;

let running = false;

export async function refreshPlaces(force = false): Promise<void> {
  if (running) return;
  running = true;
  const stale = (count: number, updatedAt: Date | null) =>
    force || count === 0 || !updatedAt || Date.now() - updatedAt.getTime() >= MAX_AGE_MS;
  try {
    const places = await placesStatus();
    if (stale(places.count, places.updatedAt)) {
      const n = await importPlaces();
      console.log(`✅ [places] uvezeno ${n} objekata iz OpenStreetMapa`);
    }
  } catch (err) {
    console.warn(`[places] uvoz nije uspio: ${err}`);
  }
  try {
    const { rows: [g] } = await db.query<{ count: string; updated_at: Date | null }>(
      'SELECT COUNT(*) AS count, MAX(updated_at) AS updated_at FROM gazetteer'
    );
    if (stale(Number(g.count), g.updated_at)) {
      const n = await importGazetteer();
      console.log(`✅ [gazetteer] uvezeno ${n} ulica i naselja`);
    }
  } catch (err) {
    console.warn(`[gazetteer] uvoz nije uspio: ${err}`);
  } finally {
    running = false;
  }
}

export function startPlacesJob(): { stop: () => void } {
  void refreshPlaces();
  // Svaki sat provjera; stvarni uvoz samo kad su podaci stariji od dana
  const task = cron.schedule('17 * * * *', () => void refreshPlaces());
  console.log('✅ Places job (OpenStreetMap objekti) scheduled hourly');
  return task;
}
