import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import {
  USER_COLUMNS, consumePasswordReset, createPasswordReset, createSession, deleteSession,
  findUserByEmail, hashPassword, mailer, passwordResetMail, toPublicUser, userForSession,
  verifyGoogleIdToken, verifyPassword,
} from "../services/accounts";
import { createLimiter } from "../services/rateLimit";
import { hashIp } from "../services/reports";

// Sesija ide u headeru "Authorization: Bearer <token>" (web je na drugom domenu od API-ja,
// pa kolačići ne bi radili bez SameSite=None; mobilna aplikacija ionako šalje header)
export function bearer(req: FastifyRequest): string | null {
  const m = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "Lozinka mora imati bar 8 znakova").max(200);

const RegisterSchema = z.object({ email, password, name: z.string().trim().min(1).max(80).optional() });
const LoginSchema = z.object({ email, password: z.string().min(1).max(200) });
const GoogleSchema = z.object({ credential: z.string().min(20).max(4096) });
const ForgotSchema = z.object({ email });
const ResetSchema = z.object({ token: z.string().min(20).max(200), password });

// Pokušaji prijave i registracije po IP hashu; zahtjevi za reset i po IP-u i po emailu
export const authLimits = {
  login:  createLimiter({ max: 10, windowMs: 60_000 }),
  forgot: createLimiter({ max: 5,  windowMs: 15 * 60_000 }),
};

function limited(req: FastifyRequest, reply: FastifyReply, limiter: ReturnType<typeof createLimiter>, key = hashIp(req.ip)): boolean {
  if (!limiter.limited(key)) return false;
  reply.status(429).send({ error: "Previše pokušaja, pokušajte ponovo za minut" });
  return true;
}

async function startSession(userId: string) {
  const token = await createSession(userId);
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  return { token, user: toPublicUser(rows[0]) };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    if (limited(req, reply, authLimits.login)) return;
    const body = RegisterSchema.parse(req.body);
    if (await findUserByEmail(body.email)) {
      return reply.status(409).send({ error: "Račun sa ovim emailom već postoji. Prijavite se ili resetujte lozinku." });
    }
    const passwordHash = await hashPassword(body.password);
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING id`,
      [body.email, body.name ?? null, passwordHash]
    );
    if (!rows[0]) return reply.status(409).send({ error: "Račun sa ovim emailom već postoji." });
    return reply.status(201).send(await startSession(rows[0].id));
  });

  app.post("/auth/login", async (req, reply) => {
    if (limited(req, reply, authLimits.login)) return;
    const body = LoginSchema.parse(req.body);
    const user = await findUserByEmail(body.email);
    // Ista poruka za nepostojeći email i pogrešnu lozinku
    if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) {
      const hint = user && !user.password_hash ? " Ovaj račun koristi Google prijavu." : "";
      return reply.status(401).send({ error: `Pogrešan email ili lozinka.${hint}` });
    }
    return startSession(user.id);
  });

  app.post("/auth/google", async (req, reply) => {
    if (limited(req, reply, authLimits.login)) return;
    const { credential } = GoogleSchema.parse(req.body);
    const identity = await verifyGoogleIdToken(credential);
    if (!identity) return reply.status(401).send({ error: "Google prijava nije uspjela." });

    // Postojeći Google račun → postojeći račun sa istim (Googleom potvrđenim) emailom → novi račun
    const { rows: bySub } = await db.query<{ id: string }>("SELECT id FROM users WHERE google_sub = $1", [identity.sub]);
    let userId = bySub[0]?.id;
    if (!userId) {
      const existing = await findUserByEmail(identity.email);
      if (existing) {
        await db.query("UPDATE users SET google_sub = $2, name = COALESCE(name, $3) WHERE id = $1",
          [existing.id, identity.sub, identity.name]);
        userId = existing.id;
      } else {
        const { rows } = await db.query<{ id: string }>(
          "INSERT INTO users (email, name, google_sub) VALUES ($1, $2, $3) RETURNING id",
          [identity.email.toLowerCase(), identity.name, identity.sub]
        );
        userId = rows[0].id;
      }
    }
    return startSession(userId);
  });

  app.get("/auth/me", async (req, reply) => {
    const token = bearer(req);
    const user = token ? await userForSession(token) : null;
    if (!user) return reply.status(401).send({ error: "Niste prijavljeni" });
    return { user: toPublicUser(user) };
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = bearer(req);
    if (token) await deleteSession(token);
    return reply.status(204).send();
  });

  // Uvijek 204, da se ne može provjeriti koji emailovi imaju račun
  app.post("/auth/password/forgot", async (req, reply) => {
    const { email: address } = ForgotSchema.parse(req.body);
    if (limited(req, reply, authLimits.forgot)) return;
    if (authLimits.forgot.limited(`email:${address}`)) return reply.status(204).send();
    const user = await findUserByEmail(address);
    if (user) {
      const token = await createPasswordReset(user.id);
      mailer.send(passwordResetMail(user.email, token)).catch((err) =>
        req.log.error(`reset mail failed: ${err}`)
      );
    }
    return reply.status(204).send();
  });

  app.post("/auth/password/reset", async (req, reply) => {
    if (limited(req, reply, authLimits.login)) return;
    const body = ResetSchema.parse(req.body);
    const userId = await consumePasswordReset(body.token, body.password);
    if (!userId) return reply.status(400).send({ error: "Link za novu lozinku je istekao ili je već iskorišten." });
    return startSession(userId);
  });

  // Konfiguracija za klijenta: da li je Google prijava uključena i sa kojim Client ID-em
  app.get("/auth/config", async () => ({ googleClientId: config.googleClientId || null }));
}
