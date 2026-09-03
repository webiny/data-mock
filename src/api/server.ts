import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { createRequestContext } from "./routing/createRequestContext.js";
import { sendError } from "./routing/sendError.js";
import type { RouteRegistrar } from "./routing/types.js";

export async function createServer(
  container: Container,
  routes: RouteRegistrar[],
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  createRequestContext(app, container);

  app.setErrorHandler(async (error, _request, reply) => {
    await sendError(reply, error);
  });

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      error: {
        code: "NotFound",
        message: "Route not found.",
      },
    });
  });

  for (const register of routes) {
    await register(app);
  }

  return app;
}
