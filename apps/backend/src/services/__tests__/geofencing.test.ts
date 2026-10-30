import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../../db';
import { errorHandler } from '../../errors';
import { devicesRoutes, DEVICE_HEADER } from '../../routes/devices';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';
import { fakeEffects, deviceAt, stepOf, LAT, LNG } from '../../test/notify';

describe('nova adresa i lokacija nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let app: FastifyInstance;
  let sent: ExpoPushMessage[];

  before(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(devicesRoutes);
  });
  beforeEach(async () => {
    sent = fakeEffects();
    await resetDb();
  });
  after(async () => {
    await app.close();
    await closeDb();
  });

  const incident = (title: string, status: 'scheduled' | 'active', lat = LAT) =>
    db.query(
      `INSERT INTO incidents (type, title, status, starts_at, affected_area)
       VALUES ('water', $1, $2, $3, ST_Buffer(ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, 200)::geometry)`,
      [title, status, status === 'scheduled' ? new Date(Date.now() + 864e5) : new Date(Date.now() - 3600e3), LNG, lat]
    );

  test('nova adresa u zoni planiranog prekida daje najavu, a u zoni aktivnog početak', async () => {
    await incident('Planirano', 'scheduled');
    await incident('Aktivno', 'active');
    await incident('Daleko', 'active', LAT + 0.05);
    const id = await deviceAt({ withAddress: false });
    const res = await app.inject({
      method: 'POST', url: '/devices/me/addresses', headers: { [DEVICE_HEADER]: id },
      payload: { label: 'Kuća', address: 'Ferhadija 1', lat: LAT, lng: LNG },
    });
    assert.equal(res.statusCode, 201);
    const byStep = Object.fromEntries(sent.map((m) => [stepOf(m), m.body]));
    assert.deepEqual(byStep, { announce: 'Planirano', start: 'Aktivno' });
  });

  test('druga adresa u istoj zoni ne šalje ponovo', async () => {
    await incident('Aktivno', 'active');
    const id = await deviceAt({ withAddress: false });
    for (const label of ['Kuća', 'Posao']) {
      await app.inject({
        method: 'POST', url: '/devices/me/addresses', headers: { [DEVICE_HEADER]: id },
        payload: { label, address: `${label} 1`, lat: LAT, lng: LNG },
      });
    }
    assert.equal(sent.length, 1);
  });

  test('nova lokacija sa uključenom opcijom daje korak po statusu, samo tom uređaju', async () => {
    await incident('Aktivno', 'active');
    const other = await deviceAt();
    const id = await deviceAt({ withAddress: false });
    await db.query('UPDATE device_tokens SET location_enabled = true WHERE id = $1', [id]);
    const res = await app.inject({
      method: 'POST', url: '/devices/location', headers: { [DEVICE_HEADER]: id },
      payload: { lat: LAT, lng: LNG },
    });
    assert.equal(res.json().used, true);
    assert.equal(sent.length, 1);
    assert.equal(stepOf(sent[0]), 'start');
    const { rows } = await db.query('SELECT token_id FROM sent_notifications');
    assert.deepEqual(rows.map((r) => r.token_id), [id]);
    assert.ok(other);
  });
});
