import { timingSafeEqual } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";

// Admin endpointi traže header "Authorization: Bearer <ADMIN_TOKEN>".
// Ako ADMIN_TOKEN nije postavljen, endpointi su potpuno isključeni.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!config.adminToken) {
    return reply.status(403).send({ error: "Admin endpoints disabled" });
  }
  const given = Buffer.from(req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(config.adminToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}
