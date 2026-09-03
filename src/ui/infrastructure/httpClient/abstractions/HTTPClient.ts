import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { TypedRouteDefinition } from "~/shared/routing/defineTypedRoutes.js";
import type { IRequestArgs } from "~/shared/routing/types.js";
import type { HTTPMethod } from "~/shared/routing/defineRoute.js";

export interface IHTTPClient {
  request<TPath extends string, TParams, TBody, TResponse, TMethod extends HTTPMethod>(
    route: TypedRouteDefinition<TPath, TParams, TBody, TResponse, TMethod>,
    args: IRequestArgs<TMethod, TParams, TBody>,
  ): Promise<Result<TResponse, HTTPError>>;

  get<T>(url: string): Promise<Result<T, HTTPError>>;
  post<T>(url: string, body: unknown): Promise<Result<T, HTTPError>>;
  put<T>(url: string, body: unknown): Promise<Result<T, HTTPError>>;
  delete(url: string): Promise<Result<void, HTTPError>>;
}

export class HTTPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly data?: unknown;

  public constructor(message: string, statusCode: number, code?: string, data?: unknown) {
    super(message);
    this.name = "HTTPError";
    this.statusCode = statusCode;
    this.code = code ?? "HTTP/Error";
    this.data = data;
  }
}

export const HTTPClient = createAbstraction<IHTTPClient>("Ui/HTTPClient");

export namespace HTTPClient {
  export type Interface = IHTTPClient;
  export type Error = HTTPError;
}
