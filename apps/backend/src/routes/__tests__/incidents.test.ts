import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { errorHandler } from '../../errors';
import { db } from '../../db';
import { incidentsRoutes } from '../incidents';
import { DEVICE_HEADER } from '../devices';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';

const LAT = 43.8563;
const LNG = 18.4131;
// ~2 km sjeverno: van zone od 300 m oko (LAT, LNG)
const FAR_LAT = 43.875;

describe('lista prekida i filter "Kod mene" nad PostGIS bazom', { skip: skipWithoutDb }, () => {
  let app: FastifyInstance;

  before(async () => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(incidentsRoutes);
  });
  beforeEach(resetDb);
  after(async () => {
    await app.close();
    await closeDb();
  });

  // Aktivan prekid sa zonom od 300 m oko tačke (ili bez zone)
  const incident = async (title: string, lat: number | null, type = 'water') => {
    const { rows: [i] } = await db.query<{ id: string }>(
      `INSERT INTO incidents (type, title, status, starts_at, affected_area)
       VALUES ($1, $2, 'active', NOW() - interval '1 hour',
               CASE WHEN $3::float8 IS NULL THEN NULL
                    ELSE ST_Buffer(ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, 300)::geometry END)
       RETURNING id`,
      [type, title, lat, LNG]
    );
    return i.id;
  };

  const device = async (addressLat?: number) => {
    const { rows: [d] } = await db.query<{ id: string }>('INSERT INTO device_tokens DEFAULT VALUES RETURNING id');
    if (addressLat !== undefined) {
      await db.query(
        `INSERT INTO device_addresses (device_id, label, address, location)
         VALUES ($1, 'Kuća', 'Ferhadija 1', ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
        [d.id, LNG, addressLat]
      );
    }
    return d.id;
  };

  const list = (url: string, tokenId?: string) =>
    app.inject({ method: 'GET', url, headers: tokenId ? { [DEVICE_HEADER]: tokenId } : {} });
  const titles = (res: { json: () => unknown }) => (res.json() as { title: string }[]).map((i) => i.title).sort();

  test('mine=true vraća samo prekide čija zona sadrži adresu uređaja', async () => {
    await incident('Kod kuće', LAT);
    await incident('Daleko', FAR_LAT);
    await incident('Bez zone', null);
    const id = await device(LAT);

    const res = await list('/incidents?mine=true', id);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(titles(res), ['Kod kuće']);
  });

  test('mine=true radi i sa geo sortiranjem i filterom po tipu', async () => {
    await incident('Voda kod kuće', LAT, 'water');
    await incident('Struja kod kuće', LAT, 'electricity');
    await incident('Voda daleko', FAR_LAT, 'water');
    const id = await device(LAT);

    const res = await list(`/incidents?mine=true&type=water&lat=${LAT}&lng=${LNG}`, id);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(titles(res), ['Voda kod kuće']);
    assert.equal((res.json() as { distance_meters: number }[])[0].distance_meters, 0);
  });

  test('uređaj bez adresa dobija praznu listu', async () => {
    await incident('Kod kuće', LAT);
    const id = await device();
    const res = await list('/incidents?mine=true', id);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), []);
  });

  test('mine=true sa nepoznatim ili neispravnim tokenId-em vraća 404', async () => {
    assert.equal((await list('/incidents?mine=true', '00000000-0000-4000-8000-000000000000')).statusCode, 404);
    assert.equal((await list('/incidents?mine=true', 'nije-uuid')).statusCode, 404);
    assert.equal((await list('/incidents?mine=true')).statusCode, 404);
  });

  test('bez mine=true header ne mijenja listu', async () => {
    await incident('Kod kuće', LAT);
    await incident('Daleko', FAR_LAT);
    const id = await device(LAT);
    assert.deepEqual(titles(await list('/incidents', id)), ['Daleko', 'Kod kuće']);
    assert.deepEqual(titles(await list(`/incidents?lat=${LAT}&lng=${LNG}`)), ['Daleko', 'Kod kuće']);
  });

  test('status i today filteri rade kao prije', async () => {
    await incident('Aktivan', LAT);
    await db.query(
      `INSERT INTO incidents (type, title, status, starts_at) VALUES ('gas', 'Planiran sutra', 'scheduled', NOW() + interval '1 day'),
                                                                     ('gas', 'Završen jučer', 'resolved', NOW() - interval '1 day')`
    );
    assert.deepEqual(titles(await list('/incidents?status=scheduled')), ['Planiran sutra']);
    assert.deepEqual(titles(await list('/incidents?status=all&today=false')), ['Aktivan', 'Planiran sutra', 'Završen jučer']);
    assert.deepEqual(titles(await list('/incidents?status=all')), ['Aktivan', 'Planiran sutra']);
  });
});
