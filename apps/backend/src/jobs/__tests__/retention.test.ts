import { describe, test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db';
import { applyRetention, RETENTION } from '../retention.job';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';

const DAY = 864e5;

describe('rokovi čuvanja podataka nad bazom', { skip: skipWithoutDb }, () => {
  beforeEach(resetDb);
  after(closeDb);

  const report = (createdDaysAgo: number, status = 'expired') =>
    db.query<{ id: string }>(
      `INSERT INTO reports (type, title, address, reporter_name, contact, reporter_key, ip_hash, status, created_at)
       VALUES ('water', 'Nema vode', 'Ferhadija 1', 'Ime', '061 000 000', 'device-aaaa', 'hash', $1, NOW() - make_interval(days => $2))
       RETURNING id`,
      [status, createdDaysAgo]
    ).then((r) => r.rows[0].id);

  test('lokacija uređaja koji se nije javio 90 dana se briše, novija ostaje', async () => {
    const { rows: [old] } = await db.query<{ id: string }>(
      `INSERT INTO device_tokens (last_lat, last_lng, last_seen_at) VALUES (43.85, 18.41, NOW() - make_interval(days => $1)) RETURNING id`,
      [RETENTION.locationDays + 1]
    );
    const { rows: [recent] } = await db.query<{ id: string }>(
      `INSERT INTO device_tokens (last_lat, last_lng, last_seen_at) VALUES (43.85, 18.41, NOW() - interval '10 days') RETURNING id`
    );
    const result = await applyRetention();
    assert.equal(result.locations, 1);
    const { rows } = await db.query('SELECT id, last_lat FROM device_tokens');
    assert.equal(rows.find((r) => r.id === old.id).last_lat, null);
    assert.equal(rows.find((r) => r.id === recent.id).last_lat, 43.85);
  });

  test('ime i kontakt iz obrađene prijave se brišu nakon 7 dana, a hash IP-a nakon 30', async () => {
    const week = await report(RETENTION.reportContactDays + 1);
    const month = await report(RETENTION.reportIpHashDays + 1, 'confirmed');
    const fresh = await report(1, 'rejected');
    await applyRetention();
    const { rows } = await db.query('SELECT id, reporter_name, contact, ip_hash, reporter_key FROM reports');
    const get = (id: string) => rows.find((r) => r.id === id);
    assert.deepEqual([get(week).reporter_name, get(week).contact, get(week).ip_hash], [null, null, 'hash']);
    assert.deepEqual([get(month).reporter_name, get(month).ip_hash], [null, null]);
    assert.deepEqual([get(fresh).reporter_name, get(fresh).ip_hash], ['Ime', 'hash']);
    // Ključ prijavioca ostaje zbog blokada
    assert.equal(get(month).reporter_key, 'device-aaaa');
  });

  test('drugo pokretanje ne mijenja ništa', async () => {
    await report(40);
    await applyRetention();
    assert.deepEqual(await applyRetention(), { locations: 0, contacts: 0, ipHashes: 0 });
  });
});
