import type { Container } from "@webiny/di";

declare module "fastify" {
  interface FastifyRequest {
    container: Container;
  }
}

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ResponseType = "list" | "one" | "none";

export interface RouteConfig {
  readonly method: HTTPMethod;
  readonly path: string;
  readonly responseType: ResponseType;
  readonly responseKey?: string;
}

export interface RouteHandlerContext<TParams = unknown, TBody = unknown> {
  readonly params: TParams;
  readonly body: TBody;
  readonly container: Container;
  readonly send: RouteSend;
}

export interface RouteSend {
  list<T>(key: string, items: T[], total: number): Promise<void>;
  one<T>(key: string, value: T): Promise<void>;
  none(): Promise<void>;
  error(error: unknown): Promise<void>;
}

export type RouteHandler<TParams = unknown, TBody = unknown> = (
  context: RouteHandlerContext<TParams, TBody>,
) => Promise<void>;

export type RouteRegistrar = (app: import("fastify").FastifyInstance) => Promise<void>;
