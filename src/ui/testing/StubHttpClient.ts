import { Result } from "@webiny/stdlib";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";

export interface RecordedCall {
  method: string;
  path: string;
  params: unknown;
  body: unknown;
}

/**
 * Answers every typed route from a table keyed by path, building the same envelope the server
 * does. The presenter reaches the network through a dozen gateways; stubbing the one client under
 * them keeps the gateways and repositories real, which is where the shapes it reads come from.
 */
export class StubHttpClient {
  public readonly calls: RecordedCall[] = [];
  /** Typed routes, keyed by the route's path template. */
  public readonly data = new Map<string, unknown>();
  /** Untyped `get`/`post` calls, keyed by the literal path with no query string. */
  public readonly urlData = new Map<string, unknown>();
  public readonly failures = new Map<string, string>();

  public readonly client: HTTPClient.Interface = {
    request: (async (route: never, args: never) => {
      const definition = route as unknown as {
        method: string;
        path: string;
        responseType: "list" | "one" | "none";
        responseKey?: string;
      };
      const requestArgs = (args ?? {}) as { params?: unknown; body?: unknown };

      this.calls.push({
        method: definition.method,
        path: definition.path,
        params: requestArgs.params ?? null,
        body: requestArgs.body ?? null,
      });

      const failure = this.failures.get(definition.path);
      if (failure !== undefined) {
        return Result.fail(new Error(failure) as never);
      }

      if (definition.responseType === "none") {
        return Result.ok(undefined as never);
      }

      const key = definition.responseKey ?? "data";
      const value = this.data.get(definition.path);

      if (definition.responseType === "list") {
        const items = (value as unknown[]) ?? [];
        return Result.ok({ [key]: { items, total: items.length } } as never);
      }

      return Result.ok({ [key]: value ?? null } as never);
    }) as HTTPClient.Interface["request"],
    get: async (url: string) => this.answerUrl("GET", url, null),
    post: async (url: string, body: unknown) => this.answerUrl("POST", url, body),
    put: async (url: string, body: unknown) => this.answerUrl("PUT", url, body),
    delete: async (url: string) => {
      await this.answerUrl("DELETE", url, null);
      return Result.ok(undefined);
    },
  };

  /**
   * The untyped half of the client. A few gateways build their own URL with a query string, so
   * these are answered from `urlData`, keyed by the path with the query stripped.
   */
  private answerUrl(method: string, url: string, body: unknown): Promise<Result<never, never>> {
    const path = url.split("?")[0] ?? url;
    this.calls.push({ method, path, params: null, body });

    const failure = this.failures.get(path);
    if (failure !== undefined) {
      return Promise.resolve(Result.fail(new Error(failure) as never));
    }

    return Promise.resolve(Result.ok((this.urlData.get(path) ?? null) as never));
  }

  /** Every recorded call to one route path, narrowed to one method when two share a path. */
  public callsTo(path: string, method?: string): RecordedCall[] {
    return this.calls.filter(
      (call) => call.path === path && (method === undefined || call.method === method),
    );
  }
}

/** The real one reads `window.location`, which a node test does not have. */
export function stubListStateFactory(): URLListStateFactory.Interface {
  return {
    create: (): URLListState.Interface =>
      ({
        page: 1,
        sort: undefined,
        get: () => "",
        getMultiple: () => [],
        getDateTime: () => null,
        set: () => {},
        setMultiple: () => {},
        setDateTime: () => {},
        setPage: () => {},
        setSort: () => {},
        clear: () => {},
      }) as unknown as URLListState.Interface,
  };
}
