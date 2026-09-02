import type {
  ApiGraphQLResult,
  ApiGraphQLResultJson,
  GenericRecord,
  IGraphQLApplication,
  IGraphQLApplicationGetResult,
  IGraphQLApplicationMutationParams,
  IGraphQLApplicationMutationsParams,
  IGraphQLApplicationQueryParams,
} from "~/types.js";
import pRetry from "p-retry";
import { GraphQLError } from "~/errors/index.js";
import lodashChunk from "lodash/chunk.js";
import { logger } from "~/logger.js";

interface Params {
  url: string;
  token: string;
  tenant?: string | undefined;
}

export class GraphQLApplication implements IGraphQLApplication {
  private readonly url: string;
  private readonly headers: Headers;

  public constructor(params: Params) {
    const { url, token } = params;
    const tenant = params.tenant || "root";
    this.url = url;
    this.headers = new Headers({
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      "x-tenant": tenant,
    });
  }

  public setTenant(tenant: string): void {
    logger.debug(`Using tenant: ${tenant}.`);
    this.headers.set("x-tenant", tenant);
  }

  public async query<T>(params: IGraphQLApplicationQueryParams<T>): Promise<ApiGraphQLResult<T>> {
    const { query, path, variables, getResult } = params;

    const runQuery = () => {
      const target = this.createUrl(path);
      const options = {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          query,
          variables: variables || {},
        }),
      };

      return fetch(target, options);
    };

    const response = await pRetry(runQuery, {
      retries: 5,
      onFailedAttempt: ({ error }) => {
        logger.warn(`Failed attempt to execute query: ${error.message}.`);
      },
    });
    return this.parse(response, getResult);
  }

  public async mutation<T>(
    params: IGraphQLApplicationMutationParams<T>,
  ): Promise<ApiGraphQLResult<T>> {
    const { mutation, path, variables, getResult } = params;
    try {
      const target = this.createUrl(path);
      const options = {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          query: mutation,
          variables,
        }),
      };

      const runMutation = () => {
        return fetch(target, options);
      };

      const response = await pRetry(runMutation, {
        retries: 5,
        onFailedAttempt: ({ error }) => {
          logger.warn(`Failed attempt to execute mutation: ${error.message}.`);
        },
      });
      return await this.parse<T>(response, getResult);
    } catch (err) {
      const ex = err as GenericRecord;
      logger.error("Failed to execute mutation.");
      const names = Object.getOwnPropertyNames(ex);
      for (const name of names) {
        logger.error(
          JSON.stringify({
            name,
            value: ex[name],
          }),
        );
      }

      throw ex;
    }
  }

  public async mutations<T>(
    params: IGraphQLApplicationMutationsParams<T>,
  ): Promise<ApiGraphQLResult<T>[]> {
    const { mutation, path, variables, atOnce, getResult } = params;
    const results: ApiGraphQLResult<T>[] = [];
    const chunks = lodashChunk(variables, atOnce || 1);
    logger.debug(`Total batches to execute: ${chunks.length}.`);
    for (const index in chunks) {
      const current = Number(index) + 1;
      logger.trace(`Executing batch ${current} of ${chunks.length}...`);
      const chunk = chunks[index];
      const chunkResult = await Promise.all(
        chunk.map((vars) =>
          this.mutation<T>({
            mutation,
            path,
            variables: vars,
            getResult,
          }),
        ),
      );
      logger.trace(`...executed.`);
      for (const result of chunkResult) {
        results.push(result);
      }
    }
    return results;
  }

  private async parse<T>(
    response: Response,
    getResult: IGraphQLApplicationGetResult<T>,
  ): Promise<ApiGraphQLResult<T>> {
    if (response.status !== 200) {
      throw new GraphQLError(`Request failed with status ${response.status}.`, response.status, {
        response,
        json: JSON.stringify(await response.json()),
      });
    }
    const json = (await response.json()) as ApiGraphQLResultJson;
    return getResult(json);
  }

  private createUrl(path: string): string {
    if (path.match(/\/$/) !== null) {
      throw new Error("URL cannot end with /.");
    } else if (path.match(/^\//) === null) {
      throw new Error("URL must start with /.");
    }
    return `${this.url}${path}`;
  }
}
