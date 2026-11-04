import "dotenv/config";
import { z } from "zod";

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || "postgresql://servisneinfo:servisneinfo_pass@localhost:5434/servisneinfo_db",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || "",
  // Token za admin endpointe (/scrape-now, GET /reports); ako nije postavljen, endpointi su isključeni
  adminToken: process.env.ADMIN_TOKEN || "",
  scraperIntervalMinutes: Number(process.env.SCRAPER_INTERVAL_MINUTES) || 15,
  // Broj proxy hopova ispred servera (KTD7); 0 = nema proxyja, koristi se adresa konekcije
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS) || 0,
  // Tajna so za hash IP adrese prijavioca; bez nje se generiše nasumična pri svakom startu
  ipHashSalt: process.env.IP_HASH_SALT || "",
  // Slack-kompatibilan webhook za alarm kad scraper prestane raditi (#19); bez njega samo log
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
  // Dozvoljeni web origini (#14), zarezom odvojeni; "*" u domenu je wildcard (npr. https://*.vercel.app)
  corsOrigins: parseList(process.env.CORS_ORIGINS),
  // Adresa weba za linkove u emailu (reset lozinke) i u feedovima (ADR-0002)
  webUrl: (process.env.WEB_URL || "http://localhost:5173").replace(/\/$/, ""),
  // OAuth Client ID (tip "Web application") iz Google Cloud konzole; bez njega je Google prijava isključena
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  // Resend API ključ za slanje emaila; bez njega se email ispisuje u log (lokalni razvoj)
  resendApiKey: process.env.RESEND_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || "ServisneInfo <noreply@servisne.info>",
  // Overpass (OpenStreetMap, lista zarezom) za objekte u blizini i OSRM za rute (ADR-0004, ADR-0005)
  overpassUrl: process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter",
  osrmUrl: (process.env.OSRM_URL || "https://routing.openstreetmap.de").replace(/\/$/, ""),
  production: process.env.NODE_ENV === "production",
};

function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

const nonEmpty = z.string().trim().min(1);
const ProductionEnv = z.object({
  DATABASE_URL: nonEmpty,
  REDIS_URL: nonEmpty,
  ADMIN_TOKEN: z.string().trim().min(16, "mora imati bar 16 znakova"),
  IP_HASH_SALT: z.string().trim().min(16, "mora imati bar 16 znakova"),
  CORS_ORIGINS: nonEmpty,
});

const OPTIONAL: Record<string, string> = {
  ANTHROPIC_API_KEY: "scraperi neće izvlačiti adrese iz teksta",
  EXPO_ACCESS_TOKEN: "push ide bez Expo access tokena",
  ALERT_WEBHOOK_URL: "alarm za scrapere se samo loguje",
  GOOGLE_CLIENT_ID: "prijava preko Google računa je isključena",
  RESEND_API_KEY: "emailovi (reset lozinke) se samo ispisuju u log",
};

// Provjera env varijabli na startu (#15): u produkciji nedostajuće obavezne varijable
// zaustavljaju server, a opcione daju upozorenje. Lokalno su dovoljni defaulti.
export function checkConfig(env: NodeJS.ProcessEnv = process.env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === "production";

  if (production) {
    const parsed = ProductionEnv.safeParse(env);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const name = String(issue.path[0]);
        errors.push(issue.code === "invalid_type" ? `${name} nije postavljen` : `${name}: ${issue.message}`);
      }
    }
    if (!Number(env.TRUST_PROXY_HOPS)) {
      warnings.push("TRUST_PROXY_HOPS=0: iza proxyja svi korisnici dijele jednu IP adresu (limiti i potvrda prijava)");
    }
  }
  for (const [name, effect] of Object.entries(OPTIONAL)) {
    if (!env[name]) warnings.push(`${name} nije postavljen: ${effect}`);
  }
  if (env.TRUST_PROXY_HOPS && !/^\d+$/.test(env.TRUST_PROXY_HOPS)) errors.push("TRUST_PROXY_HOPS mora biti cijeli broj");
  if (env.SCRAPER_INTERVAL_MINUTES && !/^\d+$/.test(env.SCRAPER_INTERVAL_MINUTES)) {
    errors.push("SCRAPER_INTERVAL_MINUTES mora biti cijeli broj");
  }
  return { errors, warnings };
}

// CORS (#14): bez Origin headera (mobilna, curl) je uvijek dozvoljeno; bez liste je sve dozvoljeno
// (lokalni razvoj), a sa listom samo navedeni origini
export function corsOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin || allowed.length === 0) return true;
  return allowed.some((pattern) => {
    if (!pattern.includes("*")) return pattern === origin;
    const re = new RegExp("^" + pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^.]+") + "$");
    return re.test(origin);
  });
}

// Fastify trustProxy koji vjeruje tačno `hops` najbližih proxyja (hop 0 je adresa konekcije).
// Tipovi Fastify-ja ne primaju broj direktno, pa ga zadajemo kao funkciju.
export function trustProxyHops(hops: number): false | ((address: string, hop: number) => boolean) {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}
