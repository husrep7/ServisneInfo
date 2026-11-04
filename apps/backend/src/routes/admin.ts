import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { requireAdmin } from '../auth';
import { confirmReportsIntoIncident, reportEffects } from '../services/reports';
import type { IncidentRow } from '../services/notifications';

const ListQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected', 'expired', 'all']).default('pending'),
  limit:  z.coerce.number().min(1).max(500).default(100),
});

const IdParams = z.object({ id: z.string().uuid() });

const BlockBody = z.object({ reason: z.string().max(300).optional() });

// Moderacija prijava (R20, R21). Sve rute traže "Authorization: Bearer <ADMIN_TOKEN>" (KTD8).
export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  // Sve prijave sa ličnim podacima — samo za admina
  app.get('/admin/reports', async (req) => {
    const q = ListQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT r.id, r.type, r.title, r.description, r.address, r.municipality,
              r.reporter_name, r.contact, r.reporter_key, r.channel, r.status, r.suppressed,
              r.confirmed_at, r.confirmed_by, r.incident_id, r.created_at,
              ST_Y(r.location) AS lat, ST_X(r.location) AS lng,
              EXISTS (SELECT 1 FROM blocked_reporters b WHERE b.reporter_key = r.reporter_key) AS blocked
         FROM reports r
        WHERE ($1 = 'all' OR r.status = $1)
        ORDER BY r.created_at DESC
        LIMIT $2`,
      [q.status, q.limit]
    );
    return rows;
  });

  // Potvrda ide istim putem kao automatska (U10), uz oznaku da je potvrdio admin
  app.post('/admin/reports/:id/confirm', async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const client = await db.connect();
    let incident: IncidentRow;
    try {
      await client.query('BEGIN');
      // FOR UPDATE: dvije istovremene potvrde iste prijave ne prave dva incidenta
      const { rows: [r] } = await client.query<{ status: string; incident_id: string | null }>(
        'SELECT status, incident_id FROM reports WHERE id = $1 FOR UPDATE', [id]
      );
      if (!r) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not found' });
      }
      if (r.status !== 'pending') {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: `Report is ${r.status}`, incidentId: r.incident_id });
      }
      incident = await confirmReportsIntoIncident(client, [id], 'admin');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await reportEffects.publish('new', incident.id).catch((err) => req.log.warn(`publish failed: ${err}`));
    await reportEffects.notify(incident).catch((err) => req.log.error(`notify failed: ${err}`));
    return { incidentId: incident.id };
  });

  app.post('/admin/reports/:id/reject', async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { rows: [r] } = await db.query<{ status: string }>(
      `UPDATE reports SET status = 'rejected'
        WHERE id = $1 AND status = 'pending'
        RETURNING status`,
      [id]
    );
    if (r) return { status: r.status };
    const { rows: [existing] } = await db.query<{ status: string }>('SELECT status FROM reports WHERE id = $1', [id]);
    return existing
      ? reply.status(409).send({ error: `Report is ${existing.status}` })
      : reply.status(404).send({ error: 'Not found' });
  });

  // Blokira prijavioca ove prijave. Ključ je ID uređaja ili anonimni web ID, nikad IP hash (U11).
  app.post('/admin/reports/:id/block', async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { reason } = BlockBody.parse(req.body ?? {});
    const { rows: [r] } = await db.query<{ reporter_key: string | null }>(
      'SELECT reporter_key FROM reports WHERE id = $1', [id]
    );
    if (!r) return reply.status(404).send({ error: 'Not found' });
    if (!r.reporter_key || r.reporter_key.startsWith('ip:')) {
      return reply.status(400).send({ error: 'Report has no reporter ID; blocking by IP is not supported' });
    }
    await blockReporter(r.reporter_key, reason);
    return { reporterKey: r.reporter_key, blocked: true };
  });

  app.get('/admin/blocked', async () => {
    const { rows } = await db.query(
      `SELECT b.reporter_key, b.reason, b.created_at,
              (SELECT count(*)::int FROM reports r WHERE r.reporter_key = b.reporter_key) AS reports
         FROM blocked_reporters b
        ORDER BY b.created_at DESC`
    );
    return rows;
  });

  app.delete<{ Params: { key: string } }>('/admin/blocked/:key', async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM blocked_reporters WHERE reporter_key = $1', [req.params.key]);
    return rowCount ? { blocked: false } : reply.status(404).send({ error: 'Not found' });
  });

  // Ručno zatvaranje lažno potvrđenog korisničkog prekida, bez čekanja 6 sati
  app.post('/admin/incidents/:id/close', async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { rows: [inc] } = await db.query<{ origin: string }>('SELECT origin FROM incidents WHERE id = $1', [id]);
    if (!inc) return reply.status(404).send({ error: 'Not found' });
    if (inc.origin !== 'user') {
      return reply.status(400).send({ error: 'Only user-reported incidents can be closed manually' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE incidents SET status = 'resolved', updated_at = NOW() WHERE id = $1`, [id]
      );
      await client.query(`UPDATE reports SET status = 'rejected' WHERE incident_id = $1`, [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await reportEffects.publish('resolved', id).catch((err) => req.log.warn(`publish failed: ${err}`));
    return { status: 'resolved' };
  });
}

async function blockReporter(reporterKey: string, reason?: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO blocked_reporters (reporter_key, reason) VALUES ($1, $2)
       ON CONFLICT (reporter_key) DO UPDATE SET reason = COALESCE(EXCLUDED.reason, blocked_reporters.reason)`,
      [reporterKey, reason ?? null]
    );
    // Prijave na čekanju odmah nestaju iz javnog prikaza (R21)
    await client.query(
      `UPDATE reports SET status = 'rejected' WHERE reporter_key = $1 AND status = 'pending'`, [reporterKey]
    );
    // Njegove prijave se više ne računaju u trajanje korisničkih prekida: last_seen_at
    // se vraća na zadnju prijavu ostalih prijavilaca (ili na početak prekida)
    await client.query(
      `UPDATE incidents i
          SET last_seen_at = COALESCE(
                (SELECT max(r.created_at) FROM reports r
                  WHERE r.incident_id = i.id
                    AND NOT EXISTS (SELECT 1 FROM blocked_reporters b WHERE b.reporter_key = r.reporter_key)),
                i.starts_at, i.last_seen_at),
              updated_at = NOW()
        WHERE i.origin = 'user' AND i.status = 'active'
          AND EXISTS (SELECT 1 FROM reports r WHERE r.incident_id = i.id AND r.reporter_key = $1)`,
      [reporterKey]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
