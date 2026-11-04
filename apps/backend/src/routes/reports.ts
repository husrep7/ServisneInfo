import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashIp, listPublicReports, submitReport } from '../services/reports';
import { createLimiter } from '../services/rateLimit';

// Grubi limit protiv zatrpavanja baze (#13). Pravi limiti po prijaviocu i IP-u su u bazi (KTD10) i
// vraćaju 201; ovaj je namjerno visok jer mobilni korisnici dijele IP operatera.
export const reportFloodLimit = createLimiter({ max: 30, windowMs: 10 * 60_000 });

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
    if (reportFloodLimit.limited(hashIp(req.ip))) {
      return reply.status(429).send({ error: 'Previše prijava sa ove adrese. Pokušajte kasnije.' });
    }
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
}
