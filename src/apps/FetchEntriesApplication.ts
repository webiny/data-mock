import type {
  ApiCmsModel,
  ApiGraphQLResult,
  IBaseApplication,
  IFetchEntriesApplication,
  IModelApplication,
} from "~/types.js";
import { logger } from "~/logger.js";
import { writeJsonFileSync } from "write-json-file";
import { createModelFields } from "~/apps/utils/createModelFields.js";

interface ApiResultEntry {
  id: string;
  entryId: string;
}

interface IFetchEntriesOptions {
  cursor?: string | undefined;
  limit: number;
  fields?: string;
}

interface IStoreToFileOptions {
  filename?: string;
  entries: ApiResultEntry[];
}

export class FetchEntriesApplication implements IFetchEntriesApplication {
  private readonly app: IBaseApplication;
  public constructor(app: IBaseApplication) {
    this.app = app;
  }

  public async run(): Promise<void> {
    const modelId = this.app.getStringArg("model", "");
    if (!modelId) {
      throw new Error(`There is no model specified.`);
    }

    logger.debug(`Fetching model: ${modelId}...`);
    const model = await this.app.getApp<IModelApplication>("model").fetch(modelId);
    logger.debug("...done.");

    let cursor: string | null | undefined = null;
    let currentRequest = 1;
    const entries: ApiResultEntry[] = [];

    const maxRequests = this.app.getNumberArg("max-requests", 100);
    const limitPerRun = this.app.getNumberArg("per-request", 1000);
    const filename = this.app.getStringArg("filename", "");

    const fields = filename ? createModelFields(model.fields) : "";

    while (currentRequest < maxRequests) {
      logger.debug(`Current page: ${currentRequest}. Cursor: ${cursor || "none"}`);
      const result = await this.fetchEntries(model, {
        cursor: cursor || undefined,
        limit: limitPerRun,
        fields,
      });
      if (!result?.data) {
        logger.info(`No more to fetch. Fetched: ${entries.length} entries.`);
        return this.storeToFile({
          filename,
          entries,
        });
      }

      cursor = result.meta?.cursor;

      for (const entry of result.data) {
        entries.push(entry);
      }
      currentRequest++;
      if (!result.meta?.hasMoreItems) {
        logger.info(`No more to fetch. Fetched: ${entries.length} entries.`);
        return this.storeToFile({
          filename,
          entries,
        });
      }
    }
    logger.error(`You reached the maximum number of requests: ${maxRequests}.`);
  }

  private async fetchEntries(
    model: ApiCmsModel,
    options: IFetchEntriesOptions,
  ): Promise<ApiGraphQLResult<ApiResultEntry[]> | null> {
    const { fields, cursor, limit } = options;
    const query = /* GraphQL */ `
            query List${model.pluralApiName}($after: String, $limit: Int) {
                ${model.pluralApiName}: list${model.pluralApiName}(after: $after, limit: $limit) {
                    data {
                        id
                        entryId
                        createdOn
                        savedOn
                        createdBy {
                            id
                            displayName
                            type
                        }
                        savedBy {
                            id
                            displayName
                            type
                        }
                        ${fields}
                    }
                    meta {
                        cursor
                        hasMoreItems
                        totalCount
                    }
                    error {
                        message
                        code
                        data
                        stack
                    }
                }
            }
        `;

    return await this.app.graphql.query<ApiResultEntry[]>({
      query,
      path: "/cms/manage",
      variables: {
        after: cursor,
        limit,
      },
      getResult: (data) => {
        const content = data.data[model.pluralApiName];
        return {
          data: content.data,
          meta: content.meta,
          error: content.error,
          extensions: data.data.extensions,
        } as ApiGraphQLResult<ApiResultEntry[]>;
      },
    });
  }

  private async storeToFile(options: IStoreToFileOptions): Promise<void> {
    if (!options.filename) {
      return;
    } else if (options.entries.length === 0) {
      logger.warn(`No entries to store.`);
      return;
    }

    logger.info(`Storing entries to file: ${options.filename}`);
    writeJsonFileSync(options.filename, options.entries);
  }
}
