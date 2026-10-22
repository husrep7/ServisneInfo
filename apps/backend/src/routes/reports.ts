import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';

const CreateSchema = z.object({
  type:         z.enum(['water', 'electricity', 'gas', 'heating', 'internet']),
  title:        z.string().min(5).max(200),
  description:  z.string().max(1000).optional(),
  address:      z.string().min(3).max(300),
  municipality: z.string().default('Sarajevo'),
  reporterName: z.string().max(100).optional(),
  contact:      z.string().max(100).optional(),
});

export async function reportsRoutes(app: FastifyInstance) {
  app.post('/reports', async (req, reply) => {
    const body = CreateSchema.parse(req.body);

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO reports (type, title, description, address, municipality, reporter_name, contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [body.type, body.title, body.description ?? null, body.address,
       body.municipality, body.reporterName ?? null, body.contact ?? null]
    );

    return reply.status(201).send({ id: rows[0].id, message: 'Prijava zaprimljena. Hvala!' });
  });

  app.get('/reports', async () => {
    const { rows } = await db.query(
      `SELECT * FROM reports ORDER BY created_at DESC LIMIT 100`
    );
    return rows;
  });
}
