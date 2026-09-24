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

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    if (!body || (typeof body === "string" && body.trim().length === 0)) {
      done(null, undefined);
      return;
    }
    try {
      // JSON parse boundary: fastify types `body` as unknown for this hook, though `parseAs: "string"` guarantees a string at runtime.
      done(null, JSON.parse(body as string));
    } catch (error) {
      // JSON parse boundary: `done()` expects Error | null, the catch value is unknown.
      done(error as Error, undefined);
    }
  });

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
