import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";

export function createRequestContext(app: FastifyInstance, container: Container): void {
  app.addHook("onRequest", async (request) => {
    request.container = container.createChildContainer();
  });
}
