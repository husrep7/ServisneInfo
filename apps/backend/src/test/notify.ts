import type { ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../db';
import { config } from '../config';
import { pushTransport } from '../services/notifications';
import { incidentEffects } from '../scrapers/base';
import { geocodeLimits, nominatim } from '../services/geocoding';

export const LAT = 43.8563;
export const LNG = 18.4131;

// Lažni Expo, bez Redisa i bez pravog geokodiranja: svaka adresa je centar Sarajeva
export function fakeEffects(): ExpoPushMessage[] {
  const sent: ExpoPushMessage[] = [];
  config.anthropicApiKey = '';
  geocodeLimits.spacingMs = 0;
  nominatim.search = async () => [{ display_name: 'Ferhadija, Sarajevo', lat: String(LAT), lon: String(LNG) }];
  incidentEffects.publish = async () => {};
  pushTransport.send = async (messages) => {
    sent.push(...messages);
    return messages.map(() => ({ status: 'ok', id: 'ticket' }) as const);
  };
  return sent;
}

let n = 0;
// Uređaj sa push tokenom i adresom u centru (u zoni geokodiranih prekida)
export async function deviceAt(opts: { reminder?: number | null; withAddress?: boolean } = {}): Promise<string> {
  const { rows: [d] } = await db.query<{ id: string }>(
    `INSERT INTO device_tokens (expo_token, reminder_minutes) VALUES ($1, $2) RETURNING id`,
    [`ExponentPushToken[t${++n}]`, opts.reminder === undefined ? 60 : opts.reminder]
  );
  if (opts.withAddress !== false) {
    await db.query(
      `INSERT INTO device_addresses (device_id, label, address, location)
       VALUES ($1, 'Kuća', 'Ferhadija 1', ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
      [d.id, LNG, LAT]
    );
  }
  return d.id;
}

export const stepOf = (m: ExpoPushMessage) => (m.data as { step: string }).step;
