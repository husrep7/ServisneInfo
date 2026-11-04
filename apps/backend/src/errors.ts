import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

// Neispravan input (zod) je greška klijenta, ne servera
export function errorHandler(err: FastifyError | Error, _req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: "Invalid request", issues: err.issues });
  }
  reply.send(err);
}
