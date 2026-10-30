import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { checkConfig, corsOriginAllowed } from '../config';
import { createLimiter } from '../services/rateLimit';
import { healthChecks, healthRoutes } from '../routes/health';

const secret = 'x'.repeat(32);
const prodEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db/servisneinfo',
  REDIS_URL: 'redis://redis:6379',
  ADMIN_TOKEN: secret,
  IP_HASH_SALT: secret,
  CORS_ORIGINS: 'https://servisneinfo.ba',
  TRUST_PROXY_HOPS: '1',
  ANTHROPIC_API_KEY: 'k', EXPO_ACCESS_TOKEN: 'k', ALERT_WEBHOOK_URL: 'https://hooks.example/x',
};

test('checkConfig: ispravna produkcijska konfiguracija nema grešaka ni upozorenja', () => {
  assert.deepEqual(checkConfig(prodEnv), { errors: [], warnings: [] });
});

test('checkConfig: u produkciji nedostajuće obavezne varijable su greške sa jasnom porukom', () => {
  const { errors } = checkConfig({ NODE_ENV: 'production', ADMIN_TOKEN: 'kratak' });
  assert.ok(errors.includes('DATABASE_URL nije postavljen'), errors.join('; '));
  assert.ok(errors.includes('REDIS_URL nije postavljen'));
  assert.ok(errors.includes('IP_HASH_SALT nije postavljen'));
  assert.ok(errors.includes('CORS_ORIGINS nije postavljen'));
  assert.ok(errors.some((e) => e.startsWith('ADMIN_TOKEN:')));
});

test('checkConfig: opcione varijable daju upozorenje, a lokalno nema grešaka', () => {
  const { errors, warnings } = checkConfig({});
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.startsWith('ANTHROPIC_API_KEY')));
  assert.ok(warnings.some((w) => w.startsWith('EXPO_ACCESS_TOKEN')));
  const prodNoProxy = checkConfig({ ...prodEnv, TRUST_PROXY_HOPS: '0' });
  assert.ok(prodNoProxy.warnings.some((w) => w.startsWith('TRUST_PROXY_HOPS')));
  assert.ok(checkConfig({ TRUST_PROXY_HOPS: 'jedan' }).errors.length === 1);
});

test('corsOriginAllowed: lista, wildcard i zahtjevi bez Origin-a', () => {
  const allowed = ['https://servisneinfo.ba', 'https://*.vercel.app'];
  assert.equal(corsOriginAllowed('https://servisneinfo.ba', allowed), true);
  assert.equal(corsOriginAllowed('https://web-git-main-abc.vercel.app', allowed), true);
  assert.equal(corsOriginAllowed('https://evil.com', allowed), false);
  assert.equal(corsOriginAllowed('https://x.vercel.app.evil.com', allowed), false);
  assert.equal(corsOriginAllowed('https://a.b.vercel.app', allowed), false);
  // Mobilna i curl ne šalju Origin
  assert.equal(corsOriginAllowed(undefined, allowed), true);
  // Bez liste (lokalni razvoj) je sve dozvoljeno
  assert.equal(corsOriginAllowed('http://localhost:5173', []), true);
});

test('createLimiter: preko limita u prozoru, pa ponovo dozvoljeno', () => {
  const l = createLimiter({ max: 2, windowMs: 1000 });
  assert.equal(l.limited('a', 0), false);
  assert.equal(l.limited('a', 10), false);
  assert.equal(l.limited('a', 20), true);
  assert.equal(l.limited('b', 20), false);
  assert.equal(l.limited('a', 1015), false);
});

describe('health check', () => {
  let app: FastifyInstance;
  const original = { ...healthChecks };
  before(async () => {
    app = Fastify();
    await app.register(healthRoutes);
  });
  after(async () => {
    Object.assign(healthChecks, original);
    await app.close();
  });

  test('sve radi: 200', async () => {
    healthChecks.db = async () => {};
    healthChecks.redis = async () => {};
    const res = await app.inject('/health');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().checks, { db: 'ok', redis: 'ok' });
  });

  test('baza ne radi: 503', async () => {
    healthChecks.db = async () => { throw new Error('ECONNREFUSED'); };
    healthChecks.redis = async () => {};
    const res = await app.inject('/health');
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.json().checks, { db: 'down', redis: 'ok' });
    // Liveness ne zavisi od baze
    assert.equal((await app.inject('/health/live')).statusCode, 200);
  });

  test('Redis visi: 503 nakon timeouta, ne visi i health', async () => {
    healthChecks.db = async () => {};
    healthChecks.redis = () => new Promise(() => {});
    const started = Date.now();
    const res = await app.inject('/health/ready');
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().checks.redis, 'down');
    assert.ok(Date.now() - started < 3000);
  });
});
