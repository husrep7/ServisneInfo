import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../db';
import { reportsRoutes } from '../../routes/reports';
import { incidentsRoutes } from '../../routes/incidents';
import { updateStatuses } from '../../jobs/status.job';
import { maxDistinctPairs, reportEffects } from '../reports';
import { sarajevoDate } from '../../scrapers/base';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';
import { trustProxyHops } from '../../config';
import type { IncidentRow } from '../notifications';

// Centar Sarajeva; 0.001° geografske širine ≈ 111 m
const LAT = 43.8563;
const LNG = 18.4131;

test('maxDistinctPairs: broji samo prijave sa međusobno različitim prijaviocem i IP-om', () => {
  const p = (reporterKey: string, ipHash: string) => ({ reporterKey, ipHash });
  assert.equal(maxDistinctPairs([p('a', 'x'), p('b', 'y'), p('c', 'z')]), 3);
  assert.equal(maxDistinctPairs([p('a', 'x'), p('a', 'x'), p('a', 'x')]), 1);
  assert.equal(maxDistinctPairs([p('a', 'x'), p('b', 'x'), p('c', 'x')]), 1);
  // Tri različita prijavioca i tri različita IP-a, ali nijedna validna trojka
  assert.equal(maxDistinctPairs([p('a', 'x'), p('a', 'y'), p('a', 'z'), p('b', 'x'), p('c', 'x')]), 2);
});

describe('prijave nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let app: FastifyInstance;
  let notified: IncidentRow[];

  before(async () => {
    // Jedan povjerljivi proxy hop: req.ip je zadnja adresa u X-Forwarded-For
    app = Fastify({ trustProxy: trustProxyHops(1) });
    await app.register(reportsRoutes);
    await app.register(incidentsRoutes);
    reportEffects.notify = async (incident) => { notified.push(incident); };
    reportEffects.publish = async () => {};
  });

  beforeEach(async () => {
    notified = [];
    await resetDb();
  });

  after(async () => {
    await app.close();
    await closeDb();
  });

  const report = (opts: {
    key: string; ip: string; type?: string; lat?: number; lng?: number; channel?: 'web' | 'mobile';
    xff?: string;
  }) =>
    app.inject({
      method: 'POST',
      url: '/reports',
      headers: { 'x-forwarded-for': opts.xff ?? opts.ip },
      payload: {
        type: opts.type ?? 'water',
        title: 'Nema vode u ulici',
        address: 'Ferhadija 1',
        reporterName: 'Tajno Ime',
        contact: '061 000 000',
        lat: opts.lat ?? LAT,
        lng: opts.lng ?? LNG,
        reporterKey: opts.key,
        channel: opts.channel ?? 'web',
      },
    });

  const publicReports = async () =>
    (await app.inject({ method: 'GET', url: '/reports/public' })).json() as Record<string, unknown>[];

  const userIncidents = async () =>
    (await db.query(`SELECT id, status, last_seen_at FROM incidents WHERE origin = 'user'`)).rows;

  test('AE6: tri prijave istog prijavioca ne potvrđuju prijavu i ne šalju push', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await report({ key: 'device-aaaa', ip: `10.0.0.${i + 1}` });
      assert.equal(res.statusCode, 201);
    }
    assert.equal((await userIncidents()).length, 0);
    assert.equal(notified.length, 0);
    assert.equal((await publicReports()).length, 3);
  });

  test('AE7: tri prijave sa različitih uređaja i IP-a prave jedan korisnički prekid i šalju push u zoni', async () => {
    await db.query(
      `INSERT INTO device_tokens (expo_token, last_lat, last_lng) VALUES
         ('ExponentPushToken[unutra]', $1, $2), ('ExponentPushToken[vani]', $3, $2)`,
      [LAT + 0.0005, LNG, LAT + 0.02]
    );
    await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    await report({ key: 'device-bbbb', ip: '10.0.0.2', lat: LAT + 0.002 });
    assert.equal((await userIncidents()).length, 0);
    await report({ key: 'device-cccc', ip: '10.0.0.3', lng: LNG + 0.002 });

    const incidents = await userIncidents();
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].status, 'active');
    assert.equal(notified.length, 1);
    assert.equal(notified[0].id, incidents[0].id);

    // Zona od 150 m oko tačaka pokriva uređaj unutra, ali ne i onaj 2 km dalje
    const { rows } = await db.query(
      `SELECT dt.expo_token FROM device_tokens dt, incidents i
        WHERE i.id = $1 AND ST_Within(ST_SetSRID(ST_MakePoint(dt.last_lng, dt.last_lat), 4326), i.affected_area)`,
      [incidents[0].id]
    );
    assert.deepEqual(rows.map((r) => r.expo_token), ['ExponentPushToken[unutra]']);

    const { rows: confirmed } = await db.query(
      `SELECT count(*)::int AS n FROM reports WHERE status = 'confirmed' AND incident_id = $1`, [incidents[0].id]
    );
    assert.equal(confirmed[0].n, 3);
    assert.equal((await publicReports()).length, 0);

    // Vidljiv u podrazumijevanoj listi incidenata, sa oznakom porijekla
    const list = (await app.inject({ method: 'GET', url: '/incidents' })).json() as { id: string; origin: string }[];
    assert.equal(list.find((i) => i.id === incidents[0].id)?.origin, 'user');
  });

  test('tri različita prijavioca sa istog IP hasha ne potvrđuju prijavu', async () => {
    for (const key of ['device-aaaa', 'device-bbbb', 'device-cccc']) {
      await report({ key, ip: '10.0.0.9', channel: 'mobile' });
    }
    assert.equal((await userIncidents()).length, 0);
  });

  test('tri prijave različitih tipova na istom mjestu ne potvrđuju prijavu', async () => {
    await report({ key: 'device-aaaa', ip: '10.0.0.1', type: 'water' });
    await report({ key: 'device-bbbb', ip: '10.0.0.2', type: 'electricity' });
    await report({ key: 'device-cccc', ip: '10.0.0.3', type: 'gas' });
    assert.equal((await userIncidents()).length, 0);
  });

  test('prijava 600 m dalje se ne broji u klaster', async () => {
    await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    await report({ key: 'device-bbbb', ip: '10.0.0.2' });
    await report({ key: 'device-cccc', ip: '10.0.0.3', lat: LAT + 0.0054 });
    assert.equal((await userIncidents()).length, 0);
  });

  test('četvrta prijava istog prijavioca u sat vremena vraća 201, ali nije javna', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await report({ key: 'device-aaaa', ip: `10.0.0.${i + 1}` });
      assert.equal(res.statusCode, 201);
    }
    assert.equal((await publicReports()).length, 3);
  });

  test('četvrta web prijava sa istog IP hasha (različiti anonimni ID-evi) vraća 201, ali nije javna', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await report({ key: `anon-web-${i}0000`, ip: '10.0.0.7', lat: LAT + i * 0.01 });
      assert.equal(res.statusCode, 201);
    }
    assert.equal((await publicReports()).length, 3);
  });

  test('pet mobilnih prijava sa različitih uređaja na istom IP hashu su sve javne', async () => {
    for (let i = 0; i < 5; i++) {
      await report({ key: `device-${i}0000`, ip: '10.0.0.8', channel: 'mobile', lat: LAT + i * 0.01 });
    }
    assert.equal((await publicReports()).length, 5);
  });

  test('AE9: blokiran prijavilac dobija isti odgovor, a prijava nije javna', async () => {
    const ok = await report({ key: 'device-ok00', ip: '10.0.0.1' });
    await db.query(`INSERT INTO blocked_reporters (reporter_key) VALUES ('device-bad0')`);
    const blocked = await report({ key: 'device-bad0', ip: '10.0.0.2' });

    assert.equal(blocked.statusCode, ok.statusCode);
    assert.deepEqual(Object.keys(blocked.json()).sort(), Object.keys(ok.json()).sort());
    assert.equal(blocked.json().message, ok.json().message);
    const visible = await publicReports();
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, ok.json().id);
  });

  test('AE8: nepotvrđena prijava stara 6 sati i 1 minut ističe i nestaje iz javnog prikaza', async () => {
    const res = await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    await db.query(`UPDATE reports SET created_at = NOW() - interval '6 hours 1 minute' WHERE id = $1`, [res.json().id]);
    await updateStatuses();
    const { rows } = await db.query('SELECT status FROM reports WHERE id = $1', [res.json().id]);
    assert.equal(rows[0].status, 'expired');
    assert.equal((await publicReports()).length, 0);
  });

  test('javni odgovor nema ime, kontakt, IP hash ni ID prijavioca', async () => {
    await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    const [r] = await publicReports();
    for (const field of ['reporter_name', 'contact', 'ip_hash', 'reporter_key', 'reporterName', 'reporterKey']) {
      assert.equal(field in r, false, `${field} ne smije biti javan`);
    }
    const body = JSON.stringify(r);
    assert.equal(body.includes('Tajno Ime'), false);
    assert.equal(body.includes('device-aaaa'), false);
    assert.equal(r.lat, LAT);
  });

  const insertUserIncident = (lastSeen: Date) =>
    db.query<{ id: string }>(
      `INSERT INTO incidents (type, title, status, origin, starts_at, last_seen_at, affected_area)
       VALUES ('water', 'Nema vode (prijave građana)', 'active', 'user', $1, $1,
               ST_Buffer(ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 150)::geometry)
       RETURNING id`,
      [lastSeen, LNG, LAT]
    );

  test('korisnički prekid bez novih prijava se zatvara nakon 6 sati', async () => {
    const now = new Date();
    const { rows: [inc] } = await insertUserIncident(new Date(now.getTime() - (6 * 60 + 1) * 60_000));
    await updateStatuses(now);
    const { rows } = await db.query('SELECT status FROM incidents WHERE id = $1', [inc.id]);
    assert.equal(rows[0].status, 'resolved');
  });

  test('korisnički prekid potvrđen u 23:30 se ne zatvara u ponoć', async () => {
    const lastSeen = sarajevoDate(2026, 11, 3, 23, 30)!;
    const justAfterMidnight = sarajevoDate(2026, 11, 4, 0, 10)!;
    const { rows: [inc] } = await insertUserIncident(lastSeen);
    // Službena obavijest bez kraja, viđena isto u 23:30, zatvara se po pravilu za službene
    const { rows: [official] } = await db.query<{ id: string }>(
      `INSERT INTO incidents (type, title, status, origin, starts_at, last_seen_at)
       VALUES ('water', 'ViK obavijest', 'active', 'official', $1, $1) RETURNING id`,
      [lastSeen]
    );
    await updateStatuses(justAfterMidnight);
    const { rows } = await db.query('SELECT id, status FROM incidents');
    const status = (id: string) => rows.find((r) => r.id === id)?.status;
    assert.equal(status(inc.id), 'active');
    assert.equal(status(official.id), 'resolved');
  });

  test('ponovljene prijave istog prijavioca ne produžavaju korisnički prekid', async () => {
    await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    await report({ key: 'device-bbbb', ip: '10.0.0.2' });
    await report({ key: 'device-cccc', ip: '10.0.0.3' });
    const [inc] = await userIncidents();
    await db.query(`UPDATE incidents SET last_seen_at = NOW() - interval '1 hour' WHERE id = $1`, [inc.id]);

    await report({ key: 'device-aaaa', ip: '10.0.0.1' });
    const [same] = await userIncidents();
    assert.ok(Date.now() - new Date(same.last_seen_at).getTime() > 50 * 60_000, 'isti prijavilac ne produžava');

    // Novi prijavilac sa novog IP-a u zoni produžava isti prekid, bez novog incidenta
    await report({ key: 'device-dddd', ip: '10.0.0.4', lat: LAT + 0.0005 });
    const extended = await userIncidents();
    assert.equal(extended.length, 1);
    assert.ok(Date.now() - new Date(extended[0].last_seen_at).getTime() < 60_000, 'novi prijavilac produžava');
    assert.equal(notified.length, 1);
  });

  test('iza povjerljivog proxyja različit X-Forwarded-For daje različit hash, a lažni hop ga ne mijenja', async () => {
    const a = await report({ key: 'device-aaaa', ip: '', xff: '203.0.113.1' });
    const b = await report({ key: 'device-bbbb', ip: '', xff: '203.0.113.2' });
    const spoofed = await report({ key: 'device-cccc', ip: '', xff: '6.6.6.6, 203.0.113.1' });
    const hash = async (id: string) =>
      (await db.query('SELECT ip_hash FROM reports WHERE id = $1', [id])).rows[0].ip_hash as string;
    assert.notEqual(await hash(a.json().id), await hash(b.json().id));
    assert.equal(await hash(spoofed.json().id), await hash(a.json().id));
  });
});
