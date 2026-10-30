import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { connectDb, db } from "./db";
import { incidentsRoutes } from "./routes/incidents";
import { devicesRoutes } from "./routes/devices";
import { websocketRoutes } from "./routes/websocket";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import { geocodeRoutes } from "./routes/geocode";
import { startScraperJobs, runAllScrapers } from "./jobs/scraper.job";
import { startStatusJob } from "./jobs/status.job";
import { startReminderJob } from "./jobs/reminder.job";
import { computeHealth } from "./services/scraperHealth";
import { config, trustProxyHops } from "./config";
import { errorHandler } from "./errors";
import { requireAdmin } from "./auth";
import { SCRAPERS } from "./scrapers/index";

// trustProxy na tačan broj hopova: req.ip je prava adresa klijenta, a lažni X-Forwarded-For se ignoriše (KTD7)
const app = Fastify({ logger: true, trustProxy: trustProxyHops(config.trustProxyHops) });

async function main() {
  app.setErrorHandler(errorHandler);

  await app.register(cors, { origin: "*" });
  await app.register(websocket);

  await connectDb();

  await app.register(incidentsRoutes);
  await app.register(devicesRoutes);
  await app.register(websocketRoutes);
  await app.register(reportsRoutes);
  await app.register(adminRoutes);
  await app.register(geocodeRoutes);

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

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

  startScraperJobs();
  startStatusJob();
  startReminderJob();

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 Server running on port ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
