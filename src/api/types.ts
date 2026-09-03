import type { Container } from "@webiny/di";

declare module "fastify" {
  interface FastifyRequest {
    container: Container;
  }
}
