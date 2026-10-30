import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { connectDb, db } from "./db";
import { incidentsRoutes } from "./routes/incidents";
import { devicesRoutes } from "./routes/devices";
import { websocketRoutes, closeRedis } from "./routes/websocket";
import { healthRoutes } from "./routes/health";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import { geocodeRoutes } from "./routes/geocode";
import { startScraperJobs, runAllScrapers, stopScrapers } from "./jobs/scraper.job";
import { startStatusJob } from "./jobs/status.job";
import { startReminderJob } from "./jobs/reminder.job";
import { computeHealth } from "./services/scraperHealth";
import { config, checkConfig, corsOriginAllowed, trustProxyHops } from "./config";
import { errorHandler } from "./errors";
import { requireAdmin } from "./auth";
import { SCRAPERS } from "./scrapers/index";

// trustProxy na tačan broj hopova: req.ip je prava adresa klijenta, a lažni X-Forwarded-For se ignoriše (KTD7)
const app = Fastify({ logger: true, trustProxy: trustProxyHops(config.trustProxyHops) });

async function main() {
  // #15: pogrešna konfiguracija zaustavlja start sa jasnom porukom
  const { errors, warnings } = checkConfig();
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (errors.length > 0) {
    console.error(`❌ Neispravna konfiguracija:\n${errors.map((e) => `   - ${e}`).join("\n")}`);
    process.exit(1);
  }

  app.setErrorHandler(errorHandler);

  // #14: web smije zvati API samo sa domena iz CORS_ORIGINS; mobilna ne šalje Origin
  await app.register(cors, {
    origin: (origin, cb) => cb(null, corsOriginAllowed(origin, config.corsOrigins)),
  });
  await app.register(websocket);

  await connectDb();

  await app.register(incidentsRoutes);
  await app.register(devicesRoutes);
  await app.register(websocketRoutes);
  await app.register(reportsRoutes);
  await app.register(adminRoutes);
  await app.register(geocodeRoutes);

  await app.register(healthRoutes);

  app.get("/scraper-status", async () => {
    const { rows } = await db.query(`
      SELECT DISTINCT ON (source)
        source, incidents_found, incidents_new, error, ran_at
      FROM scraper_runs
      ORDER BY source, ran_at DESC
    `);
    // health: ok | failing (uzastopne greške) | empty (sumnjivo bez rezultata) — #19
    const health = new Map((await computeHealth()).map((h) => [h.source, h]));
    return rows.map((r) => ({ ...r, health: health.get(r.source)?.health ?? "ok", health_detail: health.get(r.source)?.detail ?? null }));
  });

  app.post("/scrape-now", { preHandler: requireAdmin }, async () => {
    const results = await runAllScrapers();
    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { source: SCRAPERS[i].name, error: String(r.reason) }
    );
  });

  const tasks = [...startScraperJobs(), startStatusJob(), startReminderJob()];
  handleShutdown(tasks);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 Server running on port ${config.port}`);
}

// #16: na SIGTERM/SIGINT zaustavi cron, sačekaj tekući scrape i zatvori konekcije (najviše ~10 s)
function handleShutdown(tasks: { stop: () => void }[]): void {
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: gašenje…`);
    const hardExit = setTimeout(() => {
      console.error("Gašenje traje predugo — izlazim");
      process.exit(1);
    }, 10_000);
    hardExit.unref();
    try {
      tasks.forEach((t) => t.stop());
      await stopScrapers(7_000);
      await app.close();
      await closeRedis();
      await db.end();
      console.log("✅ Ugašeno");
      process.exit(0);
    } catch (err) {
      console.error("Greška pri gašenju:", err);
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
