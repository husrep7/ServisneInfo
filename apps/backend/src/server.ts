import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { connectDb, db } from "./db";
import { incidentsRoutes } from "./routes/incidents";
import { devicesRoutes } from "./routes/devices";
import { websocketRoutes } from "./routes/websocket";
import { reportsRoutes } from "./routes/reports";
import { startScraperJobs } from "./jobs/scraper.job";
import { startStatusJob } from "./jobs/status.job";
import { config } from "./config";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: "*" });
  await app.register(websocket);

  await connectDb();

  await app.register(incidentsRoutes);
  await app.register(devicesRoutes);
  await app.register(websocketRoutes);
  await app.register(reportsRoutes);

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

  app.post("/scrape-now", async () => {
    const { SCRAPERS } = await import("./scrapers/index");
    const results = await Promise.allSettled(SCRAPERS.map(s => s.run()));
    return results.map((r, i) => ({
      source: SCRAPERS[i].name,
      ...(r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
    }));
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
