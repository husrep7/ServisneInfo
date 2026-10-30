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
import { startScraperJobs, runAllScrapers } from "./jobs/scraper.job";
import { startStatusJob } from "./jobs/status.job";
import { config, trustProxyHops } from "./config";
import { ZodError } from "zod";
import { requireAdmin } from "./auth";
import { SCRAPERS } from "./scrapers/index";

// trustProxy na tačan broj hopova: req.ip je prava adresa klijenta, a lažni X-Forwarded-For se ignoriše (KTD7)
const app = Fastify({ logger: true, trustProxy: trustProxyHops(config.trustProxyHops) });

async function main() {
  // Neispravan input (zod) je greška klijenta, ne servera
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: "Invalid request", issues: err.issues });
    }
    reply.send(err);
  });

  await app.register(cors, { origin: "*" });
  await app.register(websocket);

  await connectDb();

  await app.register(incidentsRoutes);
  await app.register(devicesRoutes);
  await app.register(websocketRoutes);
  await app.register(reportsRoutes);
  await app.register(adminRoutes);

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  app.get("/scraper-status", async () => {
    const { rows } = await db.query(`
      SELECT DISTINCT ON (source)
        source, incidents_found, incidents_new, error, ran_at
      FROM scraper_runs
      ORDER BY source, ran_at DESC
    `);
    return rows;
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

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 Server running on port ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
