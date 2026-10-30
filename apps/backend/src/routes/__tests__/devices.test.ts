import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { errorHandler } from '../../errors';
import { db } from '../../db';
import { devicesRoutes, DEVICE_HEADER } from '../devices';
import { notifyIncident, pushTransport } from '../../services/notifications';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';

const LAT = 43.8563;
const LNG = 18.4131;

describe('postavke i adrese uređaja nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(devicesRoutes);
  });
  beforeEach(resetDb);
  after(async () => {
    await app.close();
    await closeDb();
  });

  const register = async (payload: object = {}, tokenId?: string) => {
    const res = await app.inject({
      method: 'POST', url: '/devices/register', payload,
      headers: tokenId ? { [DEVICE_HEADER]: tokenId } : {},
    });
    assert.equal(res.statusCode, 201);
    return res.json().tokenId as string;
  };
  const as = (tokenId: string) => ({ [DEVICE_HEADER]: tokenId });
  const addAddress = (tokenId: string, label: string, lat = LAT) =>
    app.inject({
      method: 'POST', url: '/devices/me/addresses', headers: as(tokenId),
      payload: { label, address: `${label} ulica 1`, lat, lng: LNG },
    });
  const listAddresses = async (tokenId: string) =>
    (await app.inject({ method: 'GET', url: '/devices/me/addresses', headers: as(tokenId) })).json() as { label: string }[];
  const settings = async (tokenId: string) =>
    (await app.inject({ method: 'GET', url: '/devices/me/settings', headers: as(tokenId) })).json();
  const patch = (tokenId: string, payload: object) =>
    app.inject({ method: 'PATCH', url: '/devices/me/settings', headers: as(tokenId), payload });

  test('novi uređaj: lokacija isključena, podsjetnik 60 min, nijedan isključen tip', async () => {
    const id = await register();
    assert.deepEqual(await settings(id), { locationEnabled: false, reminderMinutes: 60, mutedTypes: [] });
  });

  test('registracija bez push tokena vraća tokenId sa kojim se mogu sačuvati adrese', async () => {
    const id = await register();
    const res = await addAddress(id, 'Kuća');
    assert.equal(res.statusCode, 201);
    const [a] = await listAddresses(id);
    assert.equal(a.label, 'Kuća');
    assert.equal((a as unknown as { lat: number }).lat, LAT);
  });

  test('šesta adresa vraća 400, a lista ostaje na 5', async () => {
    const id = await register();
    for (let i = 0; i < 5; i++) assert.equal((await addAddress(id, `A${i}`)).statusCode, 201);
    assert.equal((await addAddress(id, 'Šesta')).statusCode, 400);
    assert.equal((await listAddresses(id)).length, 5);
  });

  test('brisanje adrese', async () => {
    const id = await register();
    const { id: addrId } = (await addAddress(id, 'Posao')).json();
    const del = await app.inject({ method: 'DELETE', url: `/devices/me/addresses/${addrId}`, headers: as(id) });
    assert.equal(del.statusCode, 204);
    assert.equal((await listAddresses(id)).length, 0);
    // Tuđi uređaj ne može obrisati adresu
    const other = await register();
    const { id: addr2 } = (await addAddress(id, 'Kuća')).json();
    const res = await app.inject({ method: 'DELETE', url: `/devices/me/addresses/${addr2}`, headers: as(other) });
    assert.equal(res.statusCode, 404);
  });

  test('nepoznat ili nedostajući tokenId vraća 404 za postavke i adrese', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    for (const headers of [as(unknown), {}, as('nije-uuid')]) {
      assert.equal((await app.inject({ method: 'GET', url: '/devices/me/settings', headers })).statusCode, 404);
      assert.equal((await app.inject({ method: 'GET', url: '/devices/me/addresses', headers })).statusCode, 404);
      assert.equal((await app.inject({
        method: 'POST', url: '/devices/me/addresses', headers,
        payload: { label: 'X', address: 'Ulica 1', lat: LAT, lng: LNG },
      })).statusCode, 404);
    }
  });

  test('registracija sa postojećim tokenId-em i novim Expo tokenom mijenja token na istom redu, adrese ostaju', async () => {
    const id = await register({ expoToken: 'ExponentPushToken[stari]' });
    await addAddress(id, 'Kuća');
    const again = await register({ expoToken: 'ExponentPushToken[novi]' }, id);
    assert.equal(again, id);
    const { rows } = await db.query('SELECT id, expo_token FROM device_tokens');
    assert.deepEqual(rows, [{ id, expo_token: 'ExponentPushToken[novi]' }]);
    assert.equal((await listAddresses(id)).length, 1);
  });

  test('stara verzija bez tokenId-a dobija isti red za isti Expo token', async () => {
    const a = await register({ expoToken: 'ExponentPushToken[isti]' });
    const b = await register({ expoToken: 'ExponentPushToken[isti]' });
    assert.equal(a, b);
  });

  test('DeviceNotRegistered briše push token, a adrese i postavke ostaju', async () => {
    const id = await register({ expoToken: 'ExponentPushToken[obrisan]' });
    await addAddress(id, 'Kuća');
    await patch(id, { locationEnabled: true, reminderMinutes: 30 });
    await db.query('UPDATE device_tokens SET last_lat = $1, last_lng = $2 WHERE id = $3', [LAT, LNG, id]);
    const { rows: [inc] } = await db.query<{ id: string; type: string; title: string; description: string | null }>(
      `INSERT INTO incidents (type, title, status, affected_area)
       VALUES ('water', 'Test', 'active', ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 150)::geometry)
       RETURNING id, type, title, description`,
      [LNG, LAT]
    );
    const original = pushTransport.send;
    pushTransport.send = async (messages) =>
      messages.map(() => ({ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }) as never);
    try {
      await notifyIncident(inc.id, 'start');
    } finally {
      pushTransport.send = original;
    }
    const { rows: [d] } = await db.query('SELECT expo_token FROM device_tokens WHERE id = $1', [id]);
    assert.equal(d.expo_token, null);
    assert.equal((await listAddresses(id)).length, 1);
    assert.deepEqual(await settings(id), { locationEnabled: true, reminderMinutes: 30, mutedTypes: [] });
  });

  test('lokacija se ignoriše dok je isključena, a isključivanje briše zadnju lokaciju', async () => {
    const id = await register();
    const send = () => app.inject({ method: 'POST', url: '/devices/location', headers: as(id), payload: { lat: LAT, lng: LNG } });
    assert.equal((await send()).json().used, false);
    let { rows: [d] } = await db.query('SELECT last_lat FROM device_tokens WHERE id = $1', [id]);
    assert.equal(d.last_lat, null);

    await patch(id, { locationEnabled: true });
    assert.equal((await send()).json().used, true);
    ({ rows: [d] } = await db.query('SELECT last_lat, last_lng FROM device_tokens WHERE id = $1', [id]));
    assert.equal(d.last_lat, LAT);

    await patch(id, { locationEnabled: false });
    ({ rows: [d] } = await db.query('SELECT last_lat, last_lng FROM device_tokens WHERE id = $1', [id]));
    assert.deepEqual(d, { last_lat: null, last_lng: null });
  });

  test('postavljanje podsjetnika na null ga isključuje; ostala polja ostaju', async () => {
    const id = await register();
    await patch(id, { mutedTypes: ['gas'] });
    const res = await patch(id, { reminderMinutes: null });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { locationEnabled: false, reminderMinutes: null, mutedTypes: ['gas'] });
    // Izmjena drugog polja ne vraća podsjetnik
    await patch(id, { locationEnabled: true });
    assert.equal((await settings(id)).reminderMinutes, null);
  });

  test('#13: više od 30 novih uređaja na sat sa iste IP adrese vraća 429, a postojeći uređaj prolazi', async () => {
    let first = '';
    for (let i = 0; i < 30; i++) {
      const res = await app.inject({ method: 'POST', url: '/devices/register', payload: {}, remoteAddress: '10.8.8.8' });
      assert.equal(res.statusCode, 201);
      first ||= res.json().tokenId;
    }
    const over = await app.inject({ method: 'POST', url: '/devices/register', payload: {}, remoteAddress: '10.8.8.8' });
    assert.equal(over.statusCode, 429);
    const existing = await app.inject({
      method: 'POST', url: '/devices/register', payload: {}, remoteAddress: '10.8.8.8', headers: as(first),
    });
    assert.equal(existing.statusCode, 201);
  });

  test('nevažeći tip u listi isključenih vraća 400', async () => {
    const id = await register();
    const res = await patch(id, { mutedTypes: ['water', 'struja'] });
    assert.equal(res.statusCode, 400);
    assert.deepEqual((await settings(id)).mutedTypes, []);
  });
});
