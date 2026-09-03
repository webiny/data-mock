import { Result } from "@webiny/stdlib";
import { interpolatePath } from "~/shared/routing/interpolatePath.js";
import type { TypedRouteDefinition } from "~/shared/routing/defineTypedRoutes.js";
import type { IRequestArgs } from "~/shared/routing/types.js";
import type { HTTPMethod } from "~/shared/routing/defineRoute.js";
import { HTTPClient } from "./abstractions/HTTPClient.js";
import { HTTPError } from "./HTTPError.js";
import { BaseUrl } from "./abstractions/BaseUrl.js";

class FetchHTTPClientImpl implements HTTPClient.Interface {
  public constructor(private readonly baseUrl: BaseUrl.Interface) {}

  public async request<TPath extends string, TParams, TBody, TResponse, TMethod extends HTTPMethod>(
    route: TypedRouteDefinition<TPath, TParams, TBody, TResponse, TMethod>,
    args: IRequestArgs<TMethod, TParams, TBody>,
  ): Promise<Result<TResponse, HTTPError>> {
    const params = (args as { params?: Record<string, string> }).params ?? {};
    const stringParams: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      stringParams[k] = String(v);
    }
    const path = interpolatePath(route.path, stringParams);
    const url = `${this.baseUrl.value}${path}`;

    const body = "body" in args && args.body !== undefined ? args.body : undefined;

    return this.executeRequest<TResponse>(route.method, url, body);
  }

  public async get<T>(url: string): Promise<Result<T, HTTPError>> {
    return this.executeRequest<T>("GET", `${this.baseUrl.value}${url}`);
  }

  public async post<T>(url: string, body: unknown): Promise<Result<T, HTTPError>> {
    return this.executeRequest<T>("POST", `${this.baseUrl.value}${url}`, body);
  }

  public async put<T>(url: string, body: unknown): Promise<Result<T, HTTPError>> {
    return this.executeRequest<T>("PUT", `${this.baseUrl.value}${url}`, body);
  }

  public async delete(url: string): Promise<Result<void, HTTPError>> {
    return this.executeRequest<void>("DELETE", `${this.baseUrl.value}${url}`);
  }

  private async executeRequest<T>(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<Result<T, HTTPError>> {
    try {
      const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const response = await fetch(url, init);

      if (response.status === 204) {
        return Result.ok(undefined as T);
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorData = errorBody as {
          error?: { code?: string; message?: string; data?: unknown };
        };
        return Result.fail(
          new HTTPError(
            errorData.error?.message ?? `Request failed with status ${response.status}`,
            response.status,
            errorData.error?.code,
            errorData.error?.data,
          ),
        );
      }

      const data = (await response.json()) as T;
      return Result.ok(data);
    } catch (err) {
      return Result.fail(
        new HTTPError(err instanceof Error ? err.message : "Network error", 0, "HTTP/NetworkError"),
      );
    }
  }
}

export const FetchHTTPClient = HTTPClient.createImplementation({
  implementation: FetchHTTPClientImpl,
  dependencies: [BaseUrl],
});
