import type { FastifyInstance } from "fastify";
import { createSend } from "./sendTyped.js";
import type { RouteConfig, RouteHandler, RouteRegistrar } from "./types.js";

export function routeFactory<TParams = unknown, TBody = unknown>(
  config: RouteConfig,
  handler: RouteHandler<TParams, TBody>,
): RouteRegistrar {
  return async (app: FastifyInstance) => {
    app.route({
      method: config.method,
      url: config.path,
      handler: async (request, reply) => {
        const send = createSend(reply);
        return handler({
          params: request.params as TParams,
          body: request.body as TBody,
          container: request.container,
          send,
        });
      },
    });
  };
}
