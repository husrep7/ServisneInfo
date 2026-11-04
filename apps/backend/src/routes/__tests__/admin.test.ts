import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../db';
import { config } from '../../config';
import { reportsRoutes } from '../reports';
import { adminRoutes } from '../admin';
import { reportEffects } from '../../services/reports';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';
import type { IncidentRow } from '../../services/notifications';

const LAT = 43.8563;
const LNG = 18.4131;
const TOKEN = 'test-admin-token';
const auth = { authorization: `Bearer ${TOKEN}` };

describe('admin moderacija nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let app: FastifyInstance;
  let notified: IncidentRow[];
  let published: string[];

  before(async () => {
    config.adminToken = TOKEN;
    app = Fastify();
    await app.register(reportsRoutes);
    await app.register(adminRoutes);
    reportEffects.notify = async (incident) => { notified.push(incident); };
    reportEffects.publish = async (event, id) => { published.push(`${event}:${id}`); };
  });

  beforeEach(async () => {
    notified = [];
    published = [];
    await resetDb();
  });

  after(async () => {
    await app.close();
    await closeDb();
  });

  const submit = async (key: string, ip = '10.0.0.1', lat = LAT) => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      remoteAddress: ip,
      payload: {
        type: 'water', title: 'Nema vode u ulici', address: 'Ferhadija 1',
        reporterName: 'Ime Prezime', contact: '061 000 000',
        lat, lng: LNG, reporterKey: key, channel: 'mobile',
      },
    });
    return res.json().id as string;
  };

  const publicIds = async () =>
    ((await app.inject({ method: 'GET', url: '/reports/public' })).json() as { id: string }[]).map((r) => r.id);

  const post = (url: string, payload?: object) =>
    app.inject({ method: 'POST', url, headers: auth, payload });

  test('bez tokena ili sa pogrešnim tokenom vraća 401', async () => {
    const id = await submit('device-aaaa');
    for (const headers of [{}, { authorization: 'Bearer pogresan' }]) {
      for (const [method, url] of [
        ['GET', '/admin/reports'],
        ['POST', `/admin/reports/${id}/confirm`],
        ['POST', `/admin/reports/${id}/reject`],
        ['POST', `/admin/reports/${id}/block`],
        ['GET', '/admin/blocked'],
      ] as const) {
        const res = await app.inject({ method, url, headers });
        assert.equal(res.statusCode, 401, `${method} ${url}`);
      }
    }
    const { rows } = await db.query('SELECT status FROM reports WHERE id = $1', [id]);
    assert.equal(rows[0].status, 'pending');
  });

  test('bez ADMIN_TOKEN-a su admin rute isključene (403)', async () => {
    config.adminToken = '';
    try {
      const res = await app.inject({ method: 'GET', url: '/admin/reports', headers: auth });
      assert.equal(res.statusCode, 403);
    } finally {
      config.adminToken = TOKEN;
    }
  });

  test('lista prijava sadrži ime i kontakt i filtrira po statusu', async () => {
    await submit('device-aaaa');
    const res = await app.inject({ method: 'GET', url: '/admin/reports?status=pending', headers: auth });
    assert.equal(res.statusCode, 200);
    const [r] = res.json();
    assert.equal(r.reporter_name, 'Ime Prezime');
    assert.equal(r.contact, '061 000 000');
    assert.equal(r.lat, LAT);
    const confirmed = await app.inject({ method: 'GET', url: '/admin/reports?status=confirmed', headers: auth });
    assert.deepEqual(confirmed.json(), []);
  });

  test('potvrda jedne prijave stvara korisnički prekid i šalje početak uređajima u zoni', async () => {
    await db.query(
      `INSERT INTO device_tokens (expo_token, last_lat, last_lng) VALUES ('ExponentPushToken[unutra]', $1, $2)`,
      [LAT + 0.0005, LNG]
    );
    const id = await submit('device-aaaa');
    const res = await post(`/admin/reports/${id}/confirm`);
    assert.equal(res.statusCode, 200);
    const { incidentId } = res.json();

    const { rows: [inc] } = await db.query(
      `SELECT origin, status,
              (SELECT count(*)::int FROM device_tokens dt
                WHERE ST_Within(ST_SetSRID(ST_MakePoint(dt.last_lng, dt.last_lat), 4326), affected_area)) AS devices
         FROM incidents WHERE id = $1`,
      [incidentId]
    );
    assert.equal(inc.origin, 'user');
    assert.equal(inc.status, 'active');
    assert.equal(inc.devices, 1);
    assert.deepEqual(notified.map((i) => i.id), [incidentId]);

    const { rows: [r] } = await db.query('SELECT status, confirmed_by, incident_id FROM reports WHERE id = $1', [id]);
    assert.deepEqual(r, { status: 'confirmed', confirmed_by: 'admin', incident_id: incidentId });
  });

  test('potvrda već potvrđene prijave ne stvara drugi incident', async () => {
    const id = await submit('device-aaaa');
    const first = await post(`/admin/reports/${id}/confirm`);
    const second = await post(`/admin/reports/${id}/confirm`);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().incidentId, first.json().incidentId);
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM incidents`);
    assert.equal(rows[0].n, 1);
    assert.equal(notified.length, 1);
  });

  test('odbijena prijava nestaje iz javnog odgovora', async () => {
    const id = await submit('device-aaaa');
    const other = await submit('device-bbbb', '10.0.0.2', LAT + 0.01);
    const res = await post(`/admin/reports/${id}/reject`);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(await publicIds(), [other]);
    assert.equal((await post(`/admin/reports/${id}/reject`)).statusCode, 409);
  });

  test('blokada skriva sve prijave tog prijavioca na čekanju, a nova se tiho odbacuje', async () => {
    const a1 = await submit('device-bad0', '10.0.0.1');
    await submit('device-bad0', '10.0.0.1', LAT + 0.01);
    const ok = await submit('device-ok00', '10.0.0.2', LAT + 0.02);

    const res = await post(`/admin/reports/${a1}/block`, { reason: 'spam' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(await publicIds(), [ok]);

    const later = await app.inject({
      method: 'POST', url: '/reports', remoteAddress: '10.0.0.3',
      payload: { type: 'water', title: 'Nema vode opet', address: 'Ferhadija 2', lat: LAT, lng: LNG,
                 reporterKey: 'device-bad0', channel: 'mobile' },
    });
    assert.equal(later.statusCode, 201);
    assert.deepEqual(await publicIds(), [ok]);

    const blocked = await app.inject({ method: 'GET', url: '/admin/blocked', headers: auth });
    assert.equal(blocked.json()[0].reporter_key, 'device-bad0');
    assert.equal(blocked.json()[0].reason, 'spam');
  });

  test('blokirani prijavilac se više ne računa u trajanje korisničkog prekida', async () => {
    await submit('device-aaaa', '10.0.0.1');
    await submit('device-bbbb', '10.0.0.2');
    await submit('device-cccc', '10.0.0.3');
    const { rows: [inc] } = await db.query(`SELECT id FROM incidents WHERE origin = 'user'`);
    // Prve dvije prijave su starije, a zadnja (od prijavioca kojeg blokiramo) je najnovija
    await db.query(
      `UPDATE reports SET created_at = NOW() - interval '3 hours' WHERE reporter_key IN ('device-aaaa', 'device-bbbb')`
    );
    const { rows: [bad] } = await db.query(`SELECT id FROM reports WHERE reporter_key = 'device-cccc'`);
    await post(`/admin/reports/${bad.id}/block`);
    const { rows: [updated] } = await db.query('SELECT last_seen_at FROM incidents WHERE id = $1', [inc.id]);
    assert.ok(Date.now() - new Date(updated.last_seen_at).getTime() > 2.5 * 3600_000);
  });

  test('blokada prijave bez ID-a prijavioca (samo IP) vraća 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/reports', remoteAddress: '10.0.0.5',
      payload: { type: 'water', title: 'Stari klijent', address: 'Ferhadija 3' },
    });
    assert.equal((await post(`/admin/reports/${res.json().id}/block`)).statusCode, 400);
  });

  test('ručno zatvaranje korisničkog prekida ga uklanja i odbija njegove prijave', async () => {
    const id = await submit('device-aaaa');
    const { incidentId } = (await post(`/admin/reports/${id}/confirm`)).json();
    const res = await post(`/admin/incidents/${incidentId}/close`);
    assert.equal(res.statusCode, 200);

    const { rows: [inc] } = await db.query('SELECT status FROM incidents WHERE id = $1', [incidentId]);
    assert.equal(inc.status, 'resolved');
    const { rows: [r] } = await db.query('SELECT status FROM reports WHERE id = $1', [id]);
    assert.equal(r.status, 'rejected');
    assert.ok(published.includes(`resolved:${incidentId}`));
  });

  test('ručno zatvaranje službenog prekida vraća 400', async () => {
    const { rows: [inc] } = await db.query(
      `INSERT INTO incidents (type, title, status, origin) VALUES ('water', 'ViK obavijest', 'active', 'official') RETURNING id`
    );
    const res = await post(`/admin/incidents/${inc.id}/close`);
    assert.equal(res.statusCode, 400);
    const { rows: [still] } = await db.query('SELECT status FROM incidents WHERE id = $1', [inc.id]);
    assert.equal(still.status, 'active');
  });
});
