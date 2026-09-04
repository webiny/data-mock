import type { Container } from "@webiny/di";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    container: Container;
  }
}

export interface RouteSend {
  list<T>(key: string, items: T[], total: number): Promise<void>;
  one<T>(key: string, value: T, statusCode?: number): Promise<void>;
  none(): Promise<void>;
  error(error: unknown): Promise<void>;
}

export interface RouteHandlerContext<TParams = unknown, TBody = unknown> {
  readonly params: TParams;
  readonly body: TBody;
  readonly query: Record<string, string | undefined>;
  readonly container: Container;
  readonly send: RouteSend;
}

export type RouteHandler<TParams = unknown, TBody = unknown> = (
  context: RouteHandlerContext<TParams, TBody>,
) => Promise<void>;

export type RouteRegistrar = (app: FastifyInstance) => Promise<void>;
