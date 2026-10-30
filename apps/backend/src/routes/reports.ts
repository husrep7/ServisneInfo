import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { requireAdmin } from '../auth';
import { hashIp, listPublicReports, submitReport } from '../services/reports';

const CreateSchema = z.object({
  type:         z.enum(['water', 'electricity', 'gas', 'heating', 'internet']),
  title:        z.string().min(5).max(200),
  description:  z.string().max(1000).optional(),
  address:      z.string().min(3).max(300),
  municipality: z.string().default('Sarajevo'),
  reporterName: z.string().max(100).optional(),
  contact:      z.string().max(100).optional(),
  lat:          z.number().min(-90).max(90).optional(),
  lng:          z.number().min(-180).max(180).optional(),
  // Anonimni ID iz localStorage (web) ili ID uređaja (mobilna) — KTD7
  reporterKey:  z.string().min(8).max(100).optional(),
  channel:      z.enum(['web', 'mobile']).default('web'),
}).refine((b) => (b.lat === undefined) === (b.lng === undefined), {
  message: 'lat i lng se šalju zajedno',
});

export async function reportsRoutes(app: FastifyInstance) {
  app.post('/reports', async (req, reply) => {
    const body = CreateSchema.parse(req.body);
    // req.ip poštuje trustProxy (TRUST_PROXY_HOPS), pa X-Forwarded-For izvan povjerljivih hopova ne mijenja hash
    const ipHash = hashIp(req.ip);

    const { id } = await submitReport({
      ...body,
      // Stari klijenti bez ID-a dijele limit po IP hashu
      reporterKey: body.reporterKey ?? `ip:${ipHash}`,
      ipHash,
    });

    // Isti odgovor i kad je prijava tiho odbačena (blokiran ili preko limita) — KTD9
    return reply.status(201).send({ id, message: 'Prijava zaprimljena. Hvala!' });
  });

  // Nepotvrđene prijave za listu i mapu — bez imena, kontakta, IP hasha i ID-a prijavioca
  app.get('/reports/public', async () => listPublicReports());

  // Sadrži lične podatke prijavitelja — samo za admina
  app.get('/reports', { preHandler: requireAdmin }, async () => {
    const { rows } = await db.query(
      `SELECT * FROM reports ORDER BY created_at DESC LIMIT 100`
    );
    return rows;
  });
}
