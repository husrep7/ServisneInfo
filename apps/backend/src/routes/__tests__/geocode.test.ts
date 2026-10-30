import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { errorHandler } from '../../errors';
import { geocodeRoutes, geocodeRateLimit, resetGeocodeRateLimit } from '../geocode';
import { buildPolygonFromAddresses, geocodeLimits, nominatim } from '../../services/geocoding';

// Ne treba baza: Nominatim je zamijenjen, a limit po IP hashu je u memoriji
describe('GET /geocode', () => {
  let app: FastifyInstance;
  let calls: string[];
  const original = nominatim.search;
  const spacing = geocodeLimits.spacingMs;

  before(async () => {
    geocodeLimits.spacingMs = 30;
    app = Fastify();
    app.setErrorHandler(errorHandler);
    await app.register(geocodeRoutes);
  });
  beforeEach(() => {
    calls = [];
    resetGeocodeRateLimit();
    nominatim.search = async (params) => {
      calls.push(String(params.q));
      return [{ display_name: 'Ferhadija, Stari Grad, Sarajevo, Kanton Sarajevo', lat: '43.859', lon: '18.428' }];
    };
  });
  after(async () => {
    nominatim.search = original;
    geocodeLimits.spacingMs = spacing;
    await app.close();
  });

  const search = (q: string, ip = '10.0.0.1') =>
    app.inject({ method: 'GET', url: `/geocode?q=${encodeURIComponent(q)}`, remoteAddress: ip });

  test('vraća rezultate ograničene na Sarajevo', async () => {
    let params: Record<string, string | number> = {};
    nominatim.search = async (p) => { params = p; return [{ display_name: 'Ferhadija, Stari Grad, Sarajevo, BiH', lat: '43.859', lon: '18.428' }]; };
    const res = await search('Ferhadija');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), [{ label: 'Ferhadija, Stari Grad, Sarajevo', lat: 43.859, lng: 18.428 }]);
    assert.equal(params.bounded, 1);
    assert.ok(String(params.viewbox).length > 0);
  });

  test('prekratak upit vraća 400', async () => {
    assert.equal((await search('ab')).statusCode, 400);
  });

  test('niz pretraga preko limita po IP hashu vraća 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < geocodeRateLimit.perMinute + 2; i++) codes.push((await search(`Ulica ${i}`)).statusCode);
    assert.deepEqual(codes.slice(0, geocodeRateLimit.perMinute), Array(geocodeRateLimit.perMinute).fill(200));
    assert.deepEqual(codes.slice(geocodeRateLimit.perMinute), [429, 429]);
    // Drugi IP nije pogođen
    assert.equal((await search('Ulica X', '10.0.0.2')).statusCode, 200);
  });

  test('pretrage dok scraper geokodira vraćaju 429 odmah, a scraper ne čeka na njih', async () => {
    const scraperStart = Date.now();
    const scraper = buildPolygonFromAddresses(['Ferhadija 1', 'Titova 2', 'Alipašina 3']);
    // Pretrage iz različitih IP-ova, istovremeno sa scraperom
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => search(`Pretraga ${i}`, `10.1.0.${i}`)));
    assert.ok(results.every((r) => r.statusCode === 429), results.map((r) => r.statusCode).join(','));
    const wkt = await scraper;
    const scraperMs = Date.now() - scraperStart;
    assert.ok(wkt?.startsWith('MULTIPOINT('));
    // 3 scraper poziva, razmak 30 ms: bez čekanja na pretrage završava brzo
    assert.ok(scraperMs < 1000, `scraper trajao ${scraperMs} ms`);
    assert.equal(calls.filter((q) => q.startsWith('Pretraga')).length, 0);
    // Kad scraper završi, pretraga ponovo radi
    assert.equal((await search('Ferhadija', '10.2.0.1')).statusCode, 200);
  });

  test('previše istovremenih pretraga vraća 429 umjesto gomilanja reda', async () => {
    nominatim.search = async () => {
      await new Promise((r) => setTimeout(r, 100));
      return [];
    };
    const results = await Promise.all(Array.from({ length: geocodeLimits.maxUserPending + 2 }, (_, i) => search(`Ulica ${i}`, `10.3.0.${i}`)));
    const codes = results.map((r) => r.statusCode).sort();
    assert.equal(codes.filter((c) => c === 200).length, geocodeLimits.maxUserPending);
    assert.equal(codes.filter((c) => c === 429).length, 2);
  });

  test('greška Nominatima vraća 502', async () => {
    nominatim.search = async () => { throw new Error('boom'); };
    assert.equal((await search('Ferhadija')).statusCode, 502);
  });
});
