import type { FastifyInstance } from "fastify";
import type { TypedRouteDefinition } from "~/shared/routing/defineTypedRoutes.js";
import { createSend } from "./sendTyped.js";
import type { RouteHandler, RouteRegistrar } from "./types.js";

type InferParams<T> =
  T extends TypedRouteDefinition<string, infer P, unknown, unknown> ? P : unknown;

type InferBody<T> = T extends TypedRouteDefinition<string, unknown, infer B, unknown> ? B : never;

export function routeFactory<
  TRoute extends TypedRouteDefinition<string, unknown, unknown, unknown>,
>(route: TRoute, handler: RouteHandler<InferParams<TRoute>, InferBody<TRoute>>): RouteRegistrar {
  return async (app: FastifyInstance) => {
    app.route({
      method: route.method,
      url: route.path,
      handler: async (request, reply) => {
        let body: InferBody<TRoute> = request.body as InferBody<TRoute>;

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
          body = parsed.data as InferBody<TRoute>;
        }

        let params: InferParams<TRoute> = request.params as InferParams<TRoute>;

        if (route.params) {
          const parsed = route.params.safeParse(request.params);
          if (parsed.success) {
            params = parsed.data as InferParams<TRoute>;
          }
        }

        const query = (request.query ?? {}) as Record<string, string | undefined>;
        const send = createSend(reply);
        return handler({
          params,
          body,
          query,
          container: request.container,
          send,
        });
      },
    });
  };
}
