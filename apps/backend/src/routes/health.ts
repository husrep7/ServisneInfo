import { FastifyInstance } from "fastify";
import { db } from "../db";
import { pingRedis } from "./websocket";

// Provjere zavisnosti; testovi ih zamjenjuju
export const healthChecks = {
  db: async () => { await db.query("SELECT 1"); },
  redis: () => pingRedis(),
};

const TIMEOUT_MS = 2000;

async function withTimeout(p: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      p,
      new Promise<void>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function healthRoutes(app: FastifyInstance) {
  // Proces je živ (za restart kontejnera)
  app.get("/health/live", async () => ({ status: "ok" }));

  // Zavisnosti rade (#17): baza i Redis; 503 ako bilo šta ne radi
  const ready = async (_req: unknown, reply: import("fastify").FastifyReply) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      withTimeout(healthChecks.db()),
      withTimeout(healthChecks.redis()),
    ]);
    const checks = {
      db: dbResult.status === "fulfilled" ? "ok" : "down",
      redis: redisResult.status === "fulfilled" ? "ok" : "down",
    };
    const ok = checks.db === "ok" && checks.redis === "ok";
    return reply.status(ok ? 200 : 503).send({ status: ok ? "ok" : "down", checks, ts: new Date().toISOString() });
  };
  app.get("/health", ready);
  app.get("/health/ready", ready);
}
