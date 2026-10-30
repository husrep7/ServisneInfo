import { describe, test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../../db';
import { buildMessage, findRecipients, notifyIncident, pushTransport, whenText } from '../notifications';
import { sarajevoDate } from '../../scrapers/base';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';

const LAT = 43.8563;
const LNG = 18.4131;
const FAR = 43.9;

test('whenText: vrijeme po sarajevskom vremenu', () => {
  const now = sarajevoDate(2026, 11, 2, 18, 0)!;
  assert.equal(whenText(sarajevoDate(2026, 11, 3, 8, 0), sarajevoDate(2026, 11, 3, 14, 0), now), 'Sutra 08–14h');
  assert.equal(whenText(sarajevoDate(2026, 11, 2, 22, 30), null, now), 'Danas od 22:30h');
  assert.equal(whenText(sarajevoDate(2026, 11, 5, 8, 0), sarajevoDate(2026, 11, 5, 12, 0), now), '5. 11. 08–12h');
});

test('buildMessage: najava, podsjetnik i početak sa oznakom adrese', () => {
  const now = sarajevoDate(2026, 11, 2, 18, 0)!;
  const base = { id: 'x', title: 'Radovi na mreži', origin: 'official' as const };
  const water = { ...base, type: 'water', starts_at: sarajevoDate(2026, 11, 3, 8, 0), ends_at: sarajevoDate(2026, 11, 3, 14, 0) };
  assert.equal(buildMessage(water, 'announce', { matched_label: 'Kuća', reminder_minutes: 60 }, now).title,
    '💧 Sutra 08–14h nema vode – Kuća');
  const soon = { ...water, starts_at: new Date(now.getTime() + 60 * 60_000) };
  assert.equal(buildMessage(soon, 'reminder', { matched_label: 'Kuća', reminder_minutes: 60 }, now).title,
    '💧 Za 1 sat nestaje vode – Kuća');
  const user = { ...base, type: 'electricity', starts_at: null, ends_at: null, origin: 'user' as const };
  const msg = buildMessage(user, 'start', { matched_label: 'Posao', reminder_minutes: 60 }, now);
  assert.equal(msg.title, '⚡ Nema struje – Posao (prijava korisnika)');
  assert.match(msg.body, /^Prijava korisnika/);
  assert.equal(buildMessage(user, 'start', { matched_label: null, reminder_minutes: 60 }, now).title,
    '⚡ Nema struje – vaša lokacija (prijava korisnika)');
});

describe('uparivanje i slanje nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let sent: ExpoPushMessage[];
  const original = pushTransport.send;

  beforeEach(async () => {
    sent = [];
    pushTransport.send = async (messages) => {
      sent.push(...messages);
      return messages.map(() => ({ status: 'ok', id: 'ticket' }) as const);
    };
    await resetDb();
  });

  after(async () => {
    pushTransport.send = original;
    await closeDb();
  });

  let n = 0;
  const device = async (opts: {
    addresses?: { label: string; lat: number }[];
    location?: { enabled: boolean; lat: number };
    muted?: string[];
    token?: string | null;
  } = {}) => {
    const token = opts.token === undefined ? `ExponentPushToken[d${++n}]` : opts.token;
    const { rows: [d] } = await db.query<{ id: string }>(
      `INSERT INTO device_tokens (expo_token, location_enabled, last_lat, last_lng, muted_types)
       VALUES ($1, $2, $3, $4, $5::incident_type[]) RETURNING id`,
      [token, opts.location?.enabled ?? false, opts.location?.lat ?? null,
       opts.location ? LNG : null, opts.muted ?? []]
    );
    for (const a of opts.addresses ?? []) {
      await db.query(
        `INSERT INTO device_addresses (device_id, label, address, location)
         VALUES ($1, $2, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))`,
        [d.id, a.label, LNG, a.lat]
      );
    }
    return d.id;
  };

  const incident = async (type = 'water', withZone = true, extra: { starts_at?: Date; ends_at?: Date; origin?: string } = {}) => {
    const { rows: [i] } = await db.query<{ id: string }>(
      `INSERT INTO incidents (type, title, status, origin, starts_at, ends_at, affected_area)
       VALUES ($1, 'Radovi na mreži', 'scheduled', $2, $3, $4,
               CASE WHEN $5 THEN ST_Buffer(ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, 300)::geometry END)
       RETURNING id`,
      [type, extra.origin ?? 'official', extra.starts_at ?? null, extra.ends_at ?? null, withZone, LNG, LAT]
    );
    return i.id;
  };

  const ids = async (incidentId: string, step: 'announce' | 'reminder' | 'start') =>
    (await findRecipients(incidentId, step)).map((r) => r.id).sort();

  test('AE3: uređaj sa dvije adrese u istoj zoni se pojavljuje jednom i dobija jedan push', async () => {
    const d = await device({ addresses: [{ label: 'Kuća', lat: LAT }, { label: 'Posao', lat: LAT + 0.001 }] });
    const inc = await incident();
    assert.deepEqual(await ids(inc, 'announce'), [d]);
    assert.equal(await notifyIncident(inc, 'announce'), 1);
    assert.equal(sent.length, 1);
    assert.match(sent[0].title!, / – Kuća$/);
  });

  test('AE4: isključena lokacija u zoni, bez adrese u zoni — nije primalac', async () => {
    await device({ location: { enabled: false, lat: LAT }, addresses: [{ label: 'Daleko', lat: FAR }] });
    assert.deepEqual(await ids(await incident(), 'announce'), []);
  });

  test('uključena lokacija u zoni, bez adresa — jeste primalac, sa oznakom "vaša lokacija"', async () => {
    const d = await device({ location: { enabled: true, lat: LAT } });
    const inc = await incident();
    assert.deepEqual(await ids(inc, 'announce'), [d]);
    await notifyIncident(inc, 'announce');
    assert.match(sent[0].title!, /vaša lokacija/);
  });

  test('AE5: isključeno grijanje — nije primalac za grijanje, jeste za vodu u istoj zoni', async () => {
    const d = await device({ addresses: [{ label: 'Kuća', lat: LAT }], muted: ['heating'] });
    assert.deepEqual(await ids(await incident('heating'), 'announce'), []);
    assert.deepEqual(await ids(await incident('water'), 'announce'), [d]);
  });

  test('uređaj koji je dobio najavu nije primalac za najavu, ali jeste za podsjetnik', async () => {
    const d = await device({ addresses: [{ label: 'Kuća', lat: LAT }] });
    const inc = await incident();
    await notifyIncident(inc, 'announce');
    assert.deepEqual(await ids(inc, 'announce'), []);
    assert.deepEqual(await ids(inc, 'reminder'), [d]);
  });

  test('prekid bez zone nema primalaca', async () => {
    await device({ addresses: [{ label: 'Kuća', lat: LAT }], location: { enabled: true, lat: LAT } });
    assert.deepEqual(await ids(await incident('water', false), 'announce'), []);
  });

  test('uređaj bez push tokena se preskače', async () => {
    await device({ addresses: [{ label: 'Kuća', lat: LAT }], token: null });
    const inc = await incident();
    assert.equal(await notifyIncident(inc, 'announce'), 0);
    assert.equal(sent.length, 0);
  });

  test('zapis iz stare evidencije (bez koraka) se broji kao najava', async () => {
    const d = await device({ addresses: [{ label: 'Kuća', lat: LAT }] });
    const inc = await incident();
    await db.query('INSERT INTO sent_notifications (incident_id, token_id) VALUES ($1, $2)', [inc, d]);
    assert.deepEqual(await ids(inc, 'announce'), []);
    assert.deepEqual(await ids(inc, 'start'), [d]);
  });

  test('dva istovremena slanja istog koraka šalju jedan push', async () => {
    await device({ addresses: [{ label: 'Kuća', lat: LAT }] });
    const inc = await incident();
    const results = await Promise.all([notifyIncident(inc, 'announce'), notifyIncident(inc, 'announce')]);
    assert.equal(results.reduce((a, b) => a + b, 0), 1);
    assert.equal(sent.length, 1);
  });

  test('greška Expo-a oslobađa zauzeće, pa se korak može poslati ponovo', async () => {
    const d = await device({ addresses: [{ label: 'Kuća', lat: LAT }] });
    const inc = await incident();
    pushTransport.send = async (messages) => messages.map(() => ({ status: 'error', message: 'rate' }) as never);
    assert.equal(await notifyIncident(inc, 'announce'), 0);
    assert.deepEqual(await ids(inc, 'announce'), [d]);
  });

  test('tekst najave ima oznaku adrese i sarajevsko vrijeme; prekid iz prijave ima "Prijava korisnika"', async () => {
    await device({ addresses: [{ label: 'Kuća', lat: LAT }] });
    const start = new Date(Math.ceil((Date.now() + 3 * 864e5) / 3600e3) * 3600e3);
    const official = await incident('water', true, { starts_at: start, ends_at: new Date(start.getTime() + 6 * 3600e3) });
    await notifyIncident(official, 'announce');
    const hh = start.toLocaleTimeString('en-GB', { hour: '2-digit', timeZone: 'Europe/Sarajevo' }).slice(0, 2);
    assert.ok(sent[0].title!.includes(`${hh}–`), sent[0].title);
    assert.ok(sent[0].title!.endsWith('– Kuća'), sent[0].title);
    assert.equal((sent[0].data as { incidentId: string }).incidentId, official);

    const user = await incident('electricity', true, { origin: 'user' });
    await notifyIncident(user, 'start');
    assert.match(sent[1].title!, /prijava korisnika/i);
    assert.match(sent[1].body!, /^Prijava korisnika/);
  });
});
