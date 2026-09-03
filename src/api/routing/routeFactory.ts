import type { FastifyInstance } from "fastify";
import type { TypedRouteDefinition } from "~/shared/routing/defineTypedRoutes.js";
import { createSend } from "./sendTyped.js";
import type { RouteHandler, RouteRegistrar } from "./types.js";

export function routeFactory<TParams = unknown, TBody = unknown>(
  route: TypedRouteDefinition<string, unknown, unknown, unknown>,
  handler: RouteHandler<TParams, TBody>,
): RouteRegistrar {
  return async (app: FastifyInstance) => {
    app.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        let body = request.body as TBody;

        if (route.body) {
          const parsed = route.body.safeParse(request.body);
          if (!parsed.success) {
            await reply.status(400).send({
              error: {
                code: "Validation/Error",
                message: parsed.error.issues[0]?.message ?? "Invalid input",
              },
            });
            return;
          }
          body = parsed.data as TBody;
        }

        const send = createSend(reply);
        return handler({
          params: request.params as TParams,
          body,
          container: request.container,
          send,
        });
      },
    });
  };
}
