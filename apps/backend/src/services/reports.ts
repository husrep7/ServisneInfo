import { createHmac, randomBytes } from 'crypto';
import type { PoolClient } from 'pg';
import { db } from '../db';
import { config } from '../config';
import { notifyDevicesInArea, IncidentRow } from './notifications';
import { publishIncidentEvent } from '../routes/websocket';
import type { IncidentType } from '../scrapers/base';

// Pragovi iz v1 plana (KTD5, KTD6, KTD10)
export const REPORT_RULES = {
  perHourLimit:      3,   // prijava na sat po prijaviocu (i po IP hashu za web)
  pendingHours:      6,   // nepotvrđena prijava ističe nakon 6 sati
  clusterRadiusM:    500,
  clusterWindowH:    2,
  clusterSize:       3,   // 3 prijave sa 3 različita prijavioca i 3 različite IP adrese
  zoneBufferM:       150,
  userIncidentHours: 6,   // korisnički prekid se zatvara 6 sati nakon zadnje prijave
};

const salt = config.ipHashSalt || randomBytes(32).toString('hex');
if (!config.ipHashSalt) {
  console.warn('⚠️  IP_HASH_SALT nije postavljen — koristi se nasumična so (hashevi se mijenjaju pri restartu)');
}

export function hashIp(ip: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex');
}

export type Channel = 'web' | 'mobile';
export type Suppression = 'blocked' | 'rate_limit';

export interface NewReport {
  type:          IncidentType;
  title:         string;
  description?:  string;
  address:       string;
  municipality:  string;
  reporterName?: string;
  contact?:      string;
  lat?:          number;
  lng?:          number;
  reporterKey:   string;
  ipHash:        string;
  channel:       Channel;
}

// Efekti nakon potvrde — testovi ih zamjenjuju da ne šalju push i ne traže Redis.
// Kad U3 (#43) uvede slanje po koraku, ovdje se mijenja samo notify.
export const reportEffects = {
  notify:  (incident: IncidentRow) => notifyDevicesInArea(incident),
  publish: (incidentId: string) => publishIncidentEvent('new', incidentId),
};

const TYPE_TITLE: Record<IncidentType, string> = {
  water:       'Nema vode',
  electricity: 'Nema struje',
  gas:         'Nema gasa',
  heating:     'Nema grijanja',
  internet:    'Nema interneta',
};

// Najveći broj prijava u kojima su i prijavilac i IP hash međusobno različiti
// (bipartitno uparivanje prijavilac ↔ IP). Samo brojanje različitih vrijednosti
// bi pustilo npr. A/X, A/Y, A/Z, B/X, C/X — tri prijavioca i tri IP-a, a nijednu validnu trojku.
export function maxDistinctPairs(pairs: { reporterKey: string; ipHash: string }[]): number {
  const edges = new Map<string, Set<string>>();
  for (const p of pairs) {
    if (!edges.has(p.reporterKey)) edges.set(p.reporterKey, new Set());
    edges.get(p.reporterKey)!.add(p.ipHash);
  }
  const ipOwner = new Map<string, string>();
  const tryAssign = (key: string, seen: Set<string>): boolean => {
    for (const ip of edges.get(key)!) {
      if (seen.has(ip)) continue;
      seen.add(ip);
      const owner = ipOwner.get(ip);
      if (owner === undefined || tryAssign(owner, seen)) {
        ipOwner.set(ip, key);
        return true;
      }
    }
    return false;
  };
  let matched = 0;
  for (const key of edges.keys()) {
    if (tryAssign(key, new Set())) matched++;
  }
  return matched;
}

async function suppressionFor(client: PoolClient, r: NewReport): Promise<Suppression | null> {
  const { rowCount: blocked } = await client.query(
    'SELECT 1 FROM blocked_reporters WHERE reporter_key = $1', [r.reporterKey]
  );
  if (blocked) return 'blocked';

  const { rows: [byKey] } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM reports
      WHERE reporter_key = $1 AND created_at > NOW() - interval '1 hour'`,
    [r.reporterKey]
  );
  if (byKey.n >= REPORT_RULES.perHourLimit) return 'rate_limit';

  // Mobilni korisnici često dijele IP operatera, pa limit po IP-u važi samo za web (KTD10)
  if (r.channel === 'web') {
    const { rows: [byIp] } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM reports
        WHERE ip_hash = $1 AND channel = 'web' AND created_at > NOW() - interval '1 hour'`,
      [r.ipHash]
    );
    if (byIp.n >= REPORT_RULES.perHourLimit) return 'rate_limit';
  }
  return null;
}

// Pretvara prijave u korisnički incident (KTD5). Isti put koristi i admin potvrda (U11).
export async function confirmReportsIntoIncident(
  client: PoolClient,
  reportIds: string[],
  confirmedBy: 'auto' | 'admin'
): Promise<IncidentRow> {
  const { rows: [first] } = await client.query<{ type: IncidentType; n: number }>(
    'SELECT min(type::text) AS type, count(*)::int AS n FROM reports WHERE id = ANY($1)',
    [reportIds]
  );
  const { rows: [incident] } = await client.query<IncidentRow>(
    `INSERT INTO incidents
       (type, title, description, affected_area, affected_addresses, municipality,
        starts_at, last_seen_at, status, origin)
     SELECT $2::incident_type, $3, $4,
            ST_Buffer(ST_ConvexHull(ST_Collect(location))::geography, $5)::geometry,
            array_agg(DISTINCT address), min(municipality),
            min(created_at), max(created_at), 'active', 'user'
       FROM reports WHERE id = ANY($1)
     RETURNING id, type, title, description`,
    [reportIds, first.type, `${TYPE_TITLE[first.type]} (prijave građana)`,
     `Potvrđeno na osnovu prijava građana (${first.n}).`, REPORT_RULES.zoneBufferM]
  );
  await client.query(
    `UPDATE reports SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = $2, incident_id = $3
      WHERE id = ANY($1)`,
    [reportIds, confirmedBy, incident.id]
  );
  return incident;
}

type Outcome =
  | { kind: 'pending' }
  | { kind: 'extended'; incidentId: string }
  | { kind: 'confirmed'; incident: IncidentRow };

// Nova prijava u zoni već potvrđenog korisničkog prekida produžava taj prekid,
// ali samo ako taj prijavilac i taj IP još nisu podržali prekid (KTD5)
async function tryExtend(client: PoolClient, reportId: string, r: NewReport): Promise<Outcome | null> {
  const { rows: [incident] } = await client.query<{ id: string }>(
    `SELECT i.id FROM incidents i, reports r
      WHERE r.id = $1 AND i.origin = 'user' AND i.status = 'active' AND i.type = r.type
        AND i.affected_area IS NOT NULL AND ST_Intersects(i.affected_area, r.location)
      ORDER BY i.last_seen_at DESC LIMIT 1`,
    [reportId]
  );
  if (!incident) return null;

  const { rowCount: alreadySupported } = await client.query(
    'SELECT 1 FROM reports WHERE incident_id = $1 AND (reporter_key = $2 OR ip_hash = $3) LIMIT 1',
    [incident.id, r.reporterKey, r.ipHash]
  );
  // Ponovljena prijava istog prijavioca ostaje nepotvrđena i ne pravi novi prekid
  if (alreadySupported) return { kind: 'pending' };

  await client.query(
    'UPDATE incidents SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1', [incident.id]
  );
  await client.query(
    `UPDATE reports SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = 'auto', incident_id = $2
      WHERE id = $1`,
    [reportId, incident.id]
  );
  return { kind: 'extended', incidentId: incident.id };
}

// KTD6: 3 prijave istog tipa u krugu od 500 m u zadnja 2 sata, sa 3 različita prijavioca i IP-a
async function tryConfirmCluster(client: PoolClient, reportId: string): Promise<Outcome> {
  const { rows: cluster } = await client.query<{ id: string; reporter_key: string; ip_hash: string }>(
    `SELECT c.id, c.reporter_key, c.ip_hash
       FROM reports c, reports r
      WHERE r.id = $1
        AND c.type = r.type AND c.status = 'pending' AND c.suppressed IS NULL
        AND c.location IS NOT NULL
        AND c.created_at > NOW() - make_interval(hours => $2)
        AND ST_DWithin(c.location::geography, r.location::geography, $3)
        AND NOT EXISTS (SELECT 1 FROM blocked_reporters b WHERE b.reporter_key = c.reporter_key)`,
    [reportId, REPORT_RULES.clusterWindowH, REPORT_RULES.clusterRadiusM]
  );
  const distinct = maxDistinctPairs(cluster.map((c) => ({ reporterKey: c.reporter_key, ipHash: c.ip_hash })));
  if (distinct < REPORT_RULES.clusterSize) return { kind: 'pending' };

  const incident = await confirmReportsIntoIncident(client, cluster.map((c) => c.id), 'auto');
  return { kind: 'confirmed', incident };
}

export async function submitReport(r: NewReport): Promise<{ id: string; suppressed: Suppression | null; outcome: Outcome }> {
  const client = await db.connect();
  let result: { id: string; suppressed: Suppression | null; outcome: Outcome };
  try {
    await client.query('BEGIN');
    // Prijave istog tipa se obrađuju jedna po jedna, da dvije istovremene treće prijave ne naprave dva prekida
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`reports:${r.type}`]);

    const suppressed = await suppressionFor(client, r);
    const { rows: [row] } = await client.query<{ id: string }>(
      `INSERT INTO reports
         (type, title, description, address, municipality, reporter_name, contact,
          location, reporter_key, ip_hash, channel, suppressed)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               CASE WHEN $8::float8 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($9, $8), 4326) END,
               $10, $11, $12, $13)
       RETURNING id`,
      [r.type, r.title, r.description ?? null, r.address, r.municipality,
       r.reporterName ?? null, r.contact ?? null, r.lat ?? null, r.lng ?? null,
       r.reporterKey, r.ipHash, r.channel, suppressed]
    );

    let outcome: Outcome = { kind: 'pending' };
    if (!suppressed && r.lat !== undefined) {
      outcome = (await tryExtend(client, row.id, r)) ?? (await tryConfirmCluster(client, row.id));
    }
    await client.query('COMMIT');
    result = { id: row.id, suppressed, outcome };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (result.outcome.kind === 'confirmed') {
    const incident = result.outcome.incident;
    // Prijava je već sačuvana — greška u pushu ili Redisu ne smije oboriti odgovor
    await reportEffects.publish(incident.id).catch((err) => console.warn('[reports] publish failed:', String(err)));
    await reportEffects.notify(incident).catch((err) => console.error('[reports] notify failed:', String(err)));
  }
  return result;
}

// Javni prikaz: samo nepotvrđene, mlađe od 6 sati, bez ličnih podataka i ključeva (R15)
export async function listPublicReports() {
  const { rows } = await db.query(
    `SELECT id, type, title, description, address, municipality,
            ST_Y(location) AS lat, ST_X(location) AS lng, created_at
       FROM reports r
      WHERE status = 'pending' AND suppressed IS NULL
        AND created_at > NOW() - make_interval(hours => $1)
        AND NOT EXISTS (SELECT 1 FROM blocked_reporters b WHERE b.reporter_key = r.reporter_key)
      ORDER BY created_at DESC
      LIMIT 200`,
    [REPORT_RULES.pendingHours]
  );
  return rows;
}
