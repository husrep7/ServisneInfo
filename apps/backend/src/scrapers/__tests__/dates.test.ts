import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { sarajevoDate, parseBosnianDate, dedupKey } from '../base';
import { parseDatetime, parseElektroHtml } from '../elektrodistribucija';
import { parseBsDate } from '../sarajevogas';
import { parseToplane } from '../toplane';

const iso = (d: Date | null) => d?.toISOString() ?? null;

test('sarajevoDate: zimsko vrijeme (CET, UTC+1)', () => {
  assert.equal(iso(sarajevoDate(2026, 11, 3, 8, 0)), '2026-11-03T07:00:00.000Z');
});

test('sarajevoDate: ljetno vrijeme (CEST, UTC+2)', () => {
  assert.equal(iso(sarajevoDate(2026, 7, 15, 8, 0)), '2026-07-15T06:00:00.000Z');
});

test('sarajevoDate: ponoć ostaje isti kalendarski dan u Sarajevu', () => {
  assert.equal(iso(sarajevoDate(2026, 1, 10)), '2026-01-09T23:00:00.000Z');
});

test('parseBosnianDate: datum s vremenom', () => {
  assert.equal(iso(parseBosnianDate('13.09.2026. u 09:30')), '2026-09-13T07:30:00.000Z');
  assert.equal(iso(parseBosnianDate('Ponedjeljak, 12.10.2026. 05:00')), '2026-10-12T03:00:00.000Z');
});

test('parseBosnianDate: bez datuma vraća null', () => {
  assert.equal(parseBosnianDate('-'), null);
  assert.equal(parseBosnianDate(''), null);
});

test('Elektro parseDatetime: početak i kraj na isti dan (zima)', () => {
  const { startsAt, endsAt } = parseDatetime('03.11.2026', '08:00 - 14:30');
  assert.equal(iso(startsAt), '2026-11-03T07:00:00.000Z');
  assert.equal(iso(endsAt), '2026-11-03T13:30:00.000Z');
});

test('Elektro parseDatetime: bez vremena → samo početak dana', () => {
  const { startsAt, endsAt } = parseDatetime('03.11.2026', '');
  assert.equal(iso(startsAt), '2026-11-02T23:00:00.000Z');
  assert.equal(endsAt, null);
});

test('Elektro HTML: grupiše ulice po općini/terminu i preskače općine van Sarajeva', () => {
  const html = `<table>
    <tr><th>Općina</th><th>Ulica</th><th>Brojevi</th><th>Datum</th><th>Vrijeme</th></tr>
    <tr><td>Centar</td><td>Ferhadija</td><td>1-15</td><td>03.11.2026</td><td>08:00-14:00</td></tr>
    <tr><td>Centar</td><td>Titova</td><td></td><td>03.11.2026</td><td>08:00-14:00</td></tr>
    <tr><td>Zenica</td><td>Masarykova</td><td>2</td><td>03.11.2026</td><td>08:00-14:00</td></tr>
  </table>`;
  const items = parseElektroHtml(html);
  assert.equal(items.length, 1);
  assert.match(items[0].description, /Ferhadija 1-15, Titova/);
  assert.equal(iso(items[0].startsAt), '2026-11-03T07:00:00.000Z');
  assert.equal(iso(items[0].endsAt), '2026-11-03T13:00:00.000Z');
});

test('Sarajevogas parseBsDate: nazivi mjeseci', () => {
  assert.equal(iso(parseBsDate('12. Septembra 2026.')), '2026-09-11T22:00:00.000Z');
  assert.equal(iso(parseBsDate('5. januara 2026.')), '2026-01-04T23:00:00.000Z');
  assert.equal(iso(parseBsDate('5. februar 2026.')), '2026-02-04T23:00:00.000Z');
  assert.equal(parseBsDate('5. nepoznato 2026.'), null);
});

test('Toplane: kolone odgovaraju stvarnoj tabeli (8 kolona)', () => {
  const $ = cheerio.load(`<h1>Obavijest o radovima</h1><table>
    <tr><th>Kotlovnica</th><th>Adresa</th><th>Nadležnost</th><th>Nosilac radova</th>
        <th>Početak radova</th><th>Planirani rok završetka</th><th>Broj stanova</th><th>Razlog negrijanja</th></tr>
    <tr><td>Zvijezda</td><td>Hamdije Kreševljakovića br. 67</td><td>Vlasnik</td><td>Vlasnik</td>
        <td>Četvrtak, 22.10.2026. 05:00</td><td>-</td><td>1</td><td>Kvar u objektu</td></tr>
  </table>`);
  const [item, ...rest] = parseToplane($);
  assert.equal(rest.length, 0);
  assert.equal(item.title, 'Obustava grijanja — Zvijezda');
  assert.match(item.description, /Razlog: Kvar u objektu/);
  assert.equal(iso(item.startsAt), '2026-10-22T03:00:00.000Z');
  assert.equal(item.endsAt, null);
});

test('dedupKey: isti izvor/naslov/početak → isti ključ, različit početak → različit', () => {
  const base = { title: 'X', description: '', sourceUrl: '', startsAt: sarajevoDate(2026, 11, 3), endsAt: null };
  assert.equal(dedupKey('A', base), dedupKey('A', { ...base, description: 'drugačiji opis' }));
  assert.notEqual(dedupKey('A', base), dedupKey('A', { ...base, startsAt: sarajevoDate(2026, 11, 4) }));
  assert.notEqual(dedupKey('A', base), dedupKey('B', base));
});
