import { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { config } from "../config";

// All connected WebSocket clients
const clients = new Set<{ send: (data: string) => void }>();

// Redis subscriber receives "incident:new" and "incident:resolved" events
// published by the scraper pipeline and broadcasts to all WS clients.
let sub: Redis | null = null;

export async function websocketRoutes(app: FastifyInstance) {
  const client = new Redis(config.redisUrl);
  sub = client;

  await client.subscribe("incidents");

  client.on("message", (_: string, message: string) => {
    for (const client of clients) {
      try {
        client.send(message);
      } catch {
        clients.delete(client);
      }
    }
  });

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "connected", clientCount: clients.size }));

    socket.on("close", () => clients.delete(socket));
  });
}

// Call this from scrapers after inserting a new incident to broadcast to live clients
let publisher: Redis | null = null;

export async function publishIncidentEvent(
  event: "new" | "resolved",
  incidentId: string
) {
  publisher ??= new Redis(config.redisUrl);
  await publisher.publish("incidents", JSON.stringify({ type: `incident:${event}`, incidentId }));
}

// Health check (#17): PING preko publisher konekcije
export async function pingRedis(): Promise<void> {
  publisher ??= new Redis(config.redisUrl);
  const reply = await publisher.ping();
  if (reply !== "PONG") throw new Error(`Redis replied ${reply}`);
}

// Graceful shutdown (#16)
export async function closeRedis(): Promise<void> {
  await Promise.allSettled([sub?.quit(), publisher?.quit()]);
  sub = null;
  publisher = null;
}
