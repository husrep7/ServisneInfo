import { describe, test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../../db';
import { saveIncidents, type ParsedItem } from '../../scrapers/base';
import { sendDueReminders } from '../reminder.job';
import { updateStatuses } from '../status.job';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';
import { fakeEffects, deviceAt, stepOf } from '../../test/notify';

const MIN = 60_000;
const HOUR = 60 * MIN;
const SOURCE = 'KJKP Vodovod';

// Početak na punom satu, dovoljno daleko da je prekid planiran po stvarnom NOW()
const futureHour = (days: number) => new Date(Math.ceil((Date.now() + days * 864e5) / HOUR) * HOUR);

const item = (title: string, startsAt: Date | null, endsAt: Date | null): ParsedItem => ({
  title, description: 'Ferhadija 1', sourceUrl: 'https://example.com', startsAt, endsAt,
});

describe('najava, podsjetnik i početak nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let sent: ExpoPushMessage[];

  beforeEach(async () => {
    sent = fakeEffects();
    await resetDb();
  });
  after(closeDb);

  const incidentId = async (title: string) =>
    (await db.query<{ id: string }>('SELECT id FROM incidents WHERE title = $1 ORDER BY created_at DESC LIMIT 1', [title])).rows[0].id;
  const steps = () => sent.map(stepOf);

  test('AE1: najava odmah pri objavi; podsjetnik u starts_at − 60 min, a minut ranije ne', async () => {
    await deviceAt({ reminder: 60 });
    const start = futureHour(1);
    await saveIncidents([item('Prekid u utorak', start, new Date(start.getTime() + 6 * HOUR))], 'water', SOURCE);
    assert.deepEqual(steps(), ['announce']);
    const id = await incidentId('Prekid u utorak');
    // Najava je stigla dan ranije (ponedjeljak)
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 864e5)]);

    assert.equal(await sendDueReminders(new Date(start.getTime() - 61 * MIN)), 0);
    assert.equal(await sendDueReminders(new Date(start.getTime() - 60 * MIN)), 1);
    assert.deepEqual(steps(), ['announce', 'reminder']);
    assert.match(sent[1].title!, /^💧 Za 1 sat nestaje vode – Kuća$/);
  });

  test('AE2: prekid objavljen 20 minuta prije početka daje samo najavu', async () => {
    await deviceAt({ reminder: 60 });
    const start = futureHour(1);
    await saveIncidents([item('Hitni radovi', start, null)], 'water', SOURCE);
    const id = await incidentId('Hitni radovi');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 20 * MIN)]);
    assert.equal(await sendDueReminders(new Date(start.getTime() - 10 * MIN)), 0);
    assert.deepEqual(steps(), ['announce']);
  });

  test('novi aktivan prekid daje početak, a ne najavu; riješen ne daje ništa', async () => {
    await deviceAt();
    await saveIncidents([
      item('Kvar sada', new Date(Date.now() - HOUR), new Date(Date.now() + 3 * HOUR)),
      item('Završeno jučer', new Date(Date.now() - 30 * HOUR), new Date(Date.now() - 26 * HOUR)),
    ], 'water', SOURCE);
    assert.deepEqual(steps(), ['start']);
  });

  test('uređaj sa isključenim podsjetnikom dobija najavu, ali ne i podsjetnik', async () => {
    await deviceAt({ reminder: null });
    const start = futureHour(1);
    await saveIncidents([item('Bez podsjetnika', start, null)], 'water', SOURCE);
    const id = await incidentId('Bez podsjetnika');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 864e5)]);
    assert.equal(await sendDueReminders(new Date(start.getTime() - 30 * MIN)), 0);
    assert.deepEqual(steps(), ['announce']);
  });

  test('pomjeren prekid: novi termin dobija svoju najavu, stari se zatvara bez podsjetnika', async () => {
    await deviceAt({ reminder: 60 });
    const oldStart = futureHour(1);
    const newStart = futureHour(2);
    await saveIncidents([item('Radovi na mreži', oldStart, null)], 'water', SOURCE);
    const oldId = await incidentId('Radovi na mreži');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [oldId, new Date(oldStart.getTime() - 864e5)]);

    // Izvor sada objavljuje samo novi termin
    await saveIncidents([item('Radovi na mreži', newStart, null)], 'water', SOURCE);
    assert.deepEqual(steps(), ['announce', 'announce']);
    await updateStatuses(new Date());
    const { rows } = await db.query('SELECT id, status, starts_at FROM incidents ORDER BY starts_at');
    assert.deepEqual(rows.map((r) => r.status), ['resolved', 'scheduled']);
    assert.equal(rows[0].id, oldId);

    assert.equal(await sendDueReminders(new Date(oldStart.getTime() - 60 * MIN)), 0);
    assert.deepEqual(steps(), ['announce', 'announce']);
  });

  test('otkazan prekid koji nestane sa izvora ne šalje podsjetnik i ne postaje aktivan', async () => {
    await deviceAt({ reminder: 60 });
    const start = futureHour(1);
    await saveIncidents([item('Otkazano', start, null)], 'water', SOURCE);
    const id = await incidentId('Otkazano');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 864e5)]);
    await saveIncidents([], 'water', SOURCE);

    assert.equal(await sendDueReminders(new Date(start.getTime() - 60 * MIN)), 0);
    await updateStatuses(new Date(start.getTime() + 5 * MIN));
    const { rows: [r] } = await db.query('SELECT status FROM incidents WHERE id = $1', [id]);
    assert.equal(r.status, 'resolved');
  });

  test('planiran prekid se ne zatvara ako zadnji scrape izvora nije uspio', async () => {
    const start = futureHour(1);
    await saveIncidents([item('Možda otkazano', start, null)], 'water', SOURCE);
    await db.query(
      `INSERT INTO scraper_runs (source, incidents_found, incidents_new, error, ran_at) VALUES ($1, 0, 0, 'timeout', NOW() + interval '1 second')`,
      [SOURCE]
    );
    await updateStatuses(new Date());
    const { rows: [r] } = await db.query(`SELECT status FROM incidents WHERE title = 'Možda otkazano'`);
    assert.equal(r.status, 'scheduled');
  });

  test('prekid riješen prije podsjetnika ne šalje podsjetnik', async () => {
    await deviceAt({ reminder: 60 });
    const start = futureHour(1);
    await saveIncidents([item('Riješeno ranije', start, null)], 'water', SOURCE);
    const id = await incidentId('Riješeno ranije');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 864e5)]);
    await db.query(`UPDATE incidents SET status = 'resolved' WHERE id = $1`, [id]);
    assert.equal(await sendDueReminders(new Date(start.getTime() - 60 * MIN)), 0);
  });

  test('prelaz iz planiranog u aktivan ne šalje push', async () => {
    await deviceAt({ reminder: null });
    const start = futureHour(1);
    await saveIncidents([item('Počinje', start, null)], 'water', SOURCE);
    // Izvor ga i dalje objavljuje kad počne
    await db.query(`UPDATE incidents SET last_seen_at = $1 WHERE title = 'Počinje'`, [new Date(start.getTime() + 2 * MIN)]);
    await updateStatuses(new Date(start.getTime() + 5 * MIN));
    const { rows: [r] } = await db.query(`SELECT status FROM incidents WHERE title = 'Počinje'`);
    assert.equal(r.status, 'active');
    assert.deepEqual(steps(), ['announce']);
  });

  test('dva pokretanja joba u istoj minuti šalju podsjetnik samo jednom', async () => {
    await deviceAt({ reminder: 60 });
    const start = futureHour(1);
    await saveIncidents([item('Jednom', start, null)], 'water', SOURCE);
    const id = await incidentId('Jednom');
    await db.query(`UPDATE sent_notifications SET sent_at = $2 WHERE incident_id = $1`, [id, new Date(start.getTime() - 864e5)]);
    const at = new Date(start.getTime() - 59 * MIN);
    const [a, b] = await Promise.all([sendDueReminders(at), sendDueReminders(at)]);
    assert.equal(a + b, 1);
    assert.deepEqual(steps(), ['announce', 'reminder']);
  });
});
