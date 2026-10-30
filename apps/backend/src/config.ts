import "dotenv/config";

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
};

// Fastify trustProxy koji vjeruje tačno `hops` najbližih proxyja (hop 0 je adresa konekcije).
// Tipovi Fastify-ja ne primaju broj direktno, pa ga zadajemo kao funkciju.
export function trustProxyHops(hops: number): false | ((address: string, hop: number) => boolean) {
  return hops > 0 ? (_address, hop) => hop < hops : false;
}
