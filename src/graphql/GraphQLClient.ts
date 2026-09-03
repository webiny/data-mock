import { Result } from "@webiny/stdlib";
import pRetry from "p-retry";
import lodashChunk from "lodash/chunk.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { logger } from "~/logger.js";
import { GraphQLClient as Abstraction } from "./abstractions/GraphQLClient.js";
import type {
  QueryParams,
  MutationParams,
  BatchMutationParams,
  ApiGraphQLResult,
  ApiGraphQLResultJson,
  ResultExtractor,
} from "./abstractions/GraphQLClient.js";

interface GraphQLClientConfig {
  url: string;
  token: string;
  tenant: string;
  retries?: number;
  retryMinTimeout?: number;
}

class GraphQLClientImpl implements Abstraction.Interface {
  private readonly url: string;
  private readonly headerValues: Record<string, string>;
  private readonly retries: number;
  private readonly retryMinTimeout: number;

  public constructor(
    private readonly httpClient: HttpClient.Interface,
    config: GraphQLClientConfig,
  ) {
    this.url = config.url;
    this.retries = config.retries ?? 5;
    this.retryMinTimeout = config.retryMinTimeout ?? 1000;
    this.headerValues = {
      "Content-Type": "application/json",
      authorization: `Bearer ${config.token}`,
      "x-tenant": config.tenant,
    };
  }

  public setTenant(tenant: string): void {
    logger.debug(`Using tenant: ${tenant}.`);
    this.headerValues["x-tenant"] = tenant;
  }

  public async query<T>(
    params: QueryParams<T>,
  ): Promise<Result<ApiGraphQLResult<T>, GraphQLRequestError>> {
    const { query, path, variables, getResult } = params;

    const runQuery = (): Promise<HttpClient.Response> => {
      const target = this.createUrl(path);
      return this.httpClient.post(
        target,
        JSON.stringify({ query, variables: variables ?? {} }),
        this.headerValues,
      );
    };

    try {
      const response = await pRetry(runQuery, {
        retries: this.retries,
        minTimeout: this.retryMinTimeout,
        onFailedAttempt: ({ error }) => {
          logger.warn(`Failed attempt to execute query: ${error.message}.`);
        },
      });
      return this.parse(response, getResult);
    } catch (err) {
      return Result.fail(
        new GraphQLRequestError(err instanceof Error ? err.message : "Query failed", 0),
      );
    }
  }

  public async mutation<T>(
    params: MutationParams<T>,
  ): Promise<Result<ApiGraphQLResult<T>, GraphQLRequestError>> {
    const { mutation, path, variables, getResult } = params;

    const runMutation = (): Promise<HttpClient.Response> => {
      const target = this.createUrl(path);
      return this.httpClient.post(
        target,
        JSON.stringify({ query: mutation, variables }),
        this.headerValues,
      );
    };

    try {
      const response = await pRetry(runMutation, {
        retries: this.retries,
        minTimeout: this.retryMinTimeout,
        onFailedAttempt: ({ error }) => {
          logger.warn(`Failed attempt to execute mutation: ${error.message}.`);
        },
      });
      return this.parse(response, getResult);
    } catch (err) {
      logger.error("Failed to execute mutation.");
      return Result.fail(
        new GraphQLRequestError(err instanceof Error ? err.message : "Mutation failed", 0),
      );
    }
  }

  public async mutations<T>(
    params: BatchMutationParams<T>,
  ): Promise<Result<ApiGraphQLResult<T>[], GraphQLRequestError>> {
    const { mutation, path, variables, atOnce, getResult } = params;
    const results: ApiGraphQLResult<T>[] = [];
    const chunks = lodashChunk(variables, atOnce ?? 1);
    logger.debug(`Total batches to execute: ${chunks.length}.`);

    for (let i = 0; i < chunks.length; i++) {
      logger.trace(`Executing batch ${i + 1} of ${chunks.length}...`);
      const chunk = chunks[i];
      const chunkResults = await Promise.all(
        chunk.map((vars) => this.mutation<T>({ mutation, path, variables: vars, getResult })),
      );

      for (const chunkResult of chunkResults) {
        if (chunkResult.isFail()) {
          return Result.fail(chunkResult.error);
        }
        results.push(chunkResult.value);
      }
      logger.trace(`...executed.`);
    }

    return Result.ok(results);
  }

  private async parse<T>(
    response: HttpClient.Response,
    getResult: ResultExtractor<T>,
  ): Promise<Result<ApiGraphQLResult<T>, GraphQLRequestError>> {
    if (response.status !== 200) {
      const text = await response.text().catch(() => "");
      return Result.fail(
        new GraphQLRequestError(
          `Request failed with status ${response.status}.`,
          response.status,
          text,
        ),
      );
    }
    const json = (await response.json()) as ApiGraphQLResultJson;
    return Result.ok(getResult(json));
  }

  private createUrl(path: string): string {
    if (path.endsWith("/")) {
      throw new Error("URL cannot end with /.");
    }
    if (!path.startsWith("/")) {
      throw new Error("URL must start with /.");
    }
    return `${this.url}${path}`;
  }
}

export { GraphQLClientImpl };
export type { GraphQLClientConfig };
