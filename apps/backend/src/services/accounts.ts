import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import axios from "axios";
import { db } from "../db";
import { config } from "../config";

// Korisnički računi (ADR-0003). Lozinke: scrypt sa nasumičnom soli. Sesije i reset linkovi:
// nasumičan token koji zna samo klijent, a baza čuva njegov SHA-256 hash.

export const SESSION_DAYS = 30;
export const RESET_MINUTES = 60;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

// Format: scrypt$N$r$p$<sol base64>$<hash base64>
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, , , , saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export interface PublicUser {
  id:          string;
  email:       string;
  name:        string | null;
  hasPassword: boolean;
  hasGoogle:   boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  google_sub: string | null;
}

export const USER_COLUMNS = "id, email, name, password_hash, google_sub";

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, hasPassword: !!u.password_hash, hasGoogle: !!u.google_sub };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`, [email]);
  return rows[0] ?? null;
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await db.query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS]
  );
  await db.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]);
  return token;
}

export async function userForSession(token: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT ${USER_COLUMNS.split(", ").map((c) => `u.${c}`).join(", ")}
       FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.query("DELETE FROM user_sessions WHERE token_hash = $1", [hashToken(token)]);
}

// Vraća sirovi token za link u emailu; stari neiskorišteni linkovi istog korisnika prestaju važiti
export async function createPasswordReset(userId: string): Promise<string> {
  const token = newToken();
  await db.query("DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL", [userId]);
  await db.query(
    `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [hashToken(token), userId, RESET_MINUTES]
  );
  return token;
}

// Iskoristi reset token (jednom) i postavi novu lozinku; sve postojeće sesije se odjavljuju
export async function consumePasswordReset(token: string, password: string): Promise<string | null> {
  const passwordHash = await hashPassword(password);
  const { rows } = await db.query<{ user_id: string }>(
    `UPDATE password_resets SET used_at = NOW()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
      RETURNING user_id`,
    [hashToken(token)]
  );
  const userId = rows[0]?.user_id;
  if (!userId) return null;
  await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
  await db.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);
  return userId;
}

export interface GoogleIdentity {
  sub:   string;
  email: string;
  name:  string | null;
}

interface TokenInfo {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  exp?: string;
}

// Google Identity Services šalje ID token (JWT). Provjeru potpisa radi Googleov tokeninfo
// endpoint; mi provjeravamo da je token izdat za naš Client ID i da je email potvrđen.
export const google = {
  tokenInfo: async (idToken: string): Promise<TokenInfo> => {
    const res = await axios.get<TokenInfo>("https://oauth2.googleapis.com/tokeninfo", {
      params: { id_token: idToken },
      timeout: 5000,
    });
    return res.data;
  },
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  if (!config.googleClientId) return null;
  let info: TokenInfo;
  try {
    info = await google.tokenInfo(idToken);
  } catch {
    return null;
  }
  const issOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
  const verified = info.email_verified === true || info.email_verified === "true";
  const fresh = Number(info.exp) * 1000 > Date.now();
  if (info.aud !== config.googleClientId || !issOk || !verified || !fresh || !info.sub || !info.email) return null;
  return { sub: info.sub, email: info.email, name: info.name ?? null };
}

export interface MailMessage {
  to:      string;
  subject: string;
  text:    string;
  html:    string;
}

// Slanje emaila preko Resend API-ja; bez ključa (lokalno) poruka ide u log. Testovi zamjenjuju send.
export const mailer = {
  send: async (msg: MailMessage): Promise<void> => {
    if (!config.resendApiKey) {
      console.log(`✉️  [mail] (RESEND_API_KEY nije postavljen) Za: ${msg.to}\n   ${msg.subject}\n   ${msg.text}`);
      return;
    }
    await axios.post(
      "https://api.resend.com/emails",
      { from: config.mailFrom, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html },
      { headers: { Authorization: `Bearer ${config.resendApiKey}` }, timeout: 10_000 }
    );
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function passwordResetMail(to: string, token: string): MailMessage {
  const link = `${config.webUrl}/nova-lozinka?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Nova lozinka za ServisneInfo",
    text: `Zatražili ste novu lozinku. Otvorite link u narednih ${RESET_MINUTES} minuta:\n${link}\n\nAko niste vi tražili promjenu, zanemarite ovaj email.`,
    html: `<p>Zatražili ste novu lozinku za ServisneInfo.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#0E1015;color:#fff;border-radius:10px;text-decoration:none">Postavi novu lozinku</a></p>
<p style="color:#5B5F6E">Link važi ${RESET_MINUTES} minuta. Ako niste vi tražili promjenu, zanemarite ovaj email.</p>`,
  };
}
