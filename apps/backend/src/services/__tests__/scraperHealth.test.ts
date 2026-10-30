import { describe, test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db';
import { alertTransport, checkScraperHealth, evaluate } from '../scraperHealth';
import { resetDb, closeDb, skipWithoutDb } from '../../test/db';

const run = (found: number, error: string | null = null) => ({ source: 'X', incidents_found: found, error });

test('evaluate: 3 uzastopne greške = ne radi; 2 još ne', () => {
  assert.equal(evaluate('X', [run(0, 'timeout'), run(0, 'timeout'), run(0, '503'), run(4)]).health, 'failing');
  assert.equal(evaluate('X', [run(0, 'timeout'), run(0, 'timeout'), run(4)]).health, 'ok');
});

test('evaluate: 4 prazna scrapea za izvor koji obično ima podatke = sumnjivo prazan', () => {
  const usual = [run(3), run(5), run(2), run(4)];
  assert.equal(evaluate('X', [run(0), run(0), run(0), run(0), ...usual]).health, 'empty');
  assert.equal(evaluate('X', [run(0), run(0), run(0), ...usual]).health, 'ok');
  // Greške između praznih scrapea se preskaču
  assert.equal(evaluate('X', [run(0), run(0, 'timeout'), run(0), run(0), run(0), ...usual]).health, 'empty');
});

test('evaluate: izvor koji je obično prazan (npr. smetnje) nije sumnjiv', () => {
  const runs = [run(0), run(0), run(0), run(0), run(0), run(0), run(1), run(0), run(0), run(0)];
  assert.equal(evaluate('X', runs).health, 'ok');
  assert.equal(evaluate('X', [run(0), run(0), run(0), run(0)]).health, 'ok');
});

describe('alarm pri promjeni zdravlja nad bazom', { skip: skipWithoutDb }, () => {
  let alerts: string[];
  const original = alertTransport.send;

  beforeEach(async () => {
    alerts = [];
    alertTransport.send = async (text) => { alerts.push(text); };
    await resetDb();
  });
  after(async () => {
    alertTransport.send = original;
    await closeDb();
  });

  let minute = 0;
  const addRun = (source: string, found: number, error: string | null = null) =>
    db.query(
      `INSERT INTO scraper_runs (source, incidents_found, incidents_new, error, ran_at)
       VALUES ($1, $2, 0, $3, NOW() - interval '6 hours' + make_interval(mins => $4))`,
      [source, found, error, ++minute]
    );

  test('kvar šalje jedan alarm, ponovljena provjera ne šalje, oporavak šalje poruku', async () => {
    await addRun('Sarajevogas', 2);
    await addRun('KJKP Vodovod', 3);
    for (let i = 0; i < 3; i++) await addRun('Sarajevogas', 0, 'Request failed with status code 503');

    await checkScraperHealth();
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /Sarajevogas.*ne radi.*503/);

    await checkScraperHealth();
    assert.equal(alerts.length, 1);

    await addRun('Sarajevogas', 2);
    await checkScraperHealth();
    assert.equal(alerts.length, 2);
    assert.match(alerts[1], /Sarajevogas.*ponovo radi/);
  });

  test('izvor koji tiho vraća 0 rezultata se prijavljuje isti dan', async () => {
    for (const n of [4, 3, 5, 2]) await addRun('KJKP Vodovod', n);
    for (let i = 0; i < 4; i++) await addRun('KJKP Vodovod', 0);
    const health = await checkScraperHealth();
    assert.equal(health.find((h) => h.source === 'KJKP Vodovod')?.health, 'empty');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /ne vraća obavijesti/);
  });

  test('greška u slanju alarma ne ruši provjeru', async () => {
    alertTransport.send = async () => { throw new Error('webhook down'); };
    for (let i = 0; i < 3; i++) await addRun('BH Telecom', 0, 'timeout');
    const health = await checkScraperHealth();
    assert.equal(health[0].health, 'failing');
  });
});
