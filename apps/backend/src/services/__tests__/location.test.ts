import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stem, streetOnly } from '../gazetteer';
import { parseQueryKeywords } from '../search';
import { toImportedPlace } from '../places';
import { hashPassword, verifyPassword } from '../accounts';
import { shortSummary } from '../../routes/feeds';

// Bez baze: čiste funkcije za lokaciju, pretragu, feedove i lozinke

test('stem: padeži i dijakritika daju isti ključ', () => {
  assert.equal(stem('Ferhadije'), stem('Ferhadija'));
  assert.equal(stem('Grbavice'), stem('Grbavica'));
  assert.equal(stem('u Titovoj'), 'u titov');
  assert.equal(stem('Kralja Tvrtka'), 'kralj tvrtk');
  assert.equal(stem('Džemala Bijedića'), 'dzemal bijedic');
  // Ulica i naselje sličnog imena ostaju različiti
  assert.notEqual(stem('Grbavička'), stem('Grbavica'));
});

test('streetOnly: kućni brojevi i oznake iz obavijesti se skidaju', () => {
  assert.equal(streetOnly('Gatačka 1-4, 6-7, 9-13'), 'Gatačka');
  assert.equal(streetOnly('Ulica Ferhadija 1-15'), 'Ferhadija');
  assert.equal(streetOnly('Safeta Hadžića 52'), 'Safeta Hadžića');
  assert.equal(streetOnly('Put Mladih Muslimana'), 'Put Mladih Muslimana');
});

test('parseQueryKeywords: kategorija i mjesto iz prirodnog upita', () => {
  assert.deepEqual(parseQueryKeywords('bankomat kod Ferhadije'), { category: 'atm', place: 'Ferhadije', via: 'keywords' });
  assert.deepEqual(parseQueryKeywords('najbliža pumpa'), { category: 'fuel', place: null, via: 'keywords' });
  assert.deepEqual(parseQueryKeywords('Pošte u blizini moje ulice'), { category: 'post', place: null, via: 'keywords' });
  assert.equal(parseQueryKeywords('apoteka u blizini ulice Kodžaga').place, 'Kodžaga');
  assert.equal(parseQueryKeywords('banka Alipašina').category, 'bank');
  // Bez kategorije: upit je adresa
  assert.deepEqual(parseQueryKeywords('Titova 5'), { category: null, place: 'Titova 5', via: 'none' });
});

test('toImportedPlace: OSM element u objekat, banka sa bankomatom', () => {
  const bank = toImportedPlace({ type: 'node', id: 1, lat: 43.85, lon: 18.41,
    tags: { amenity: 'bank', name: 'Sparkasse', atm: 'yes', 'addr:street': 'Ferhadija', 'addr:housenumber': '2' } });
  assert.deepEqual(bank, { osmId: 'node/1', category: 'bank', name: 'Sparkasse', address: 'Ferhadija 2',
    openingHours: null, hasAtm: true, lat: 43.85, lng: 18.41 });
  const fuel = toImportedPlace({ type: 'way', id: 2, center: { lat: 43.8, lon: 18.3 }, tags: { amenity: 'fuel', brand: 'Petrol' } });
  assert.equal(fuel?.name, 'Petrol');
  assert.equal(fuel?.lat, 43.8);
  assert.equal(toImportedPlace({ type: 'node', id: 3, lat: 1, lon: 1, tags: { amenity: 'cafe' } }), null);
});

test('shortSummary: ulice bez brojeva, a bez izvučenih ulica mjesto iz naslova', () => {
  assert.equal(
    shortSummary({ type: 'electricity', title: 'x', affected_addresses: ['Gatačka 1-4', 'Gatačka 6', 'Kraljice Jelene 1', 'Safeta Hadžića 52'] }),
    'Struja · Gatačka, Kraljice Jelene i još 1'
  );
  assert.equal(
    shortSummary({ type: 'electricity', title: 'Isključenje struje — Ilijaš, 05.11.2026 13:00-14:00',
      affected_addresses: ['Planirano isključenje električne energije u Ilijaš. Zahvaćene ulice: Bosanska'] }),
    'Struja · Ilijaš'
  );
});

test('lozinke: scrypt hash prolazi samo sa tačnom lozinkom', async () => {
  const stored = await hashPassword('tajna-lozinka');
  assert.match(stored, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('tajna-lozinka', stored), true);
  assert.equal(await verifyPassword('pogresna', stored), false);
  assert.equal(await verifyPassword('x', 'neispravan-format'), false);
});
