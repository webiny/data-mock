import type {
  AcoFolder,
  AcoFolderCreateParams,
  ApiError,
  IBaseApplication,
  IFolderApplication,
  IFolderApplicationCreateViaGraphQLResponse,
  IFolderRunner,
  IFolderRunnerResponse,
} from "~/types.js";
import { getAcoFolderResult } from "./folder/getAcoFolderResult.js";
import { folderRunnerFactory } from "~/apps/folder/folders.js";
import { logger } from "~/logger.js";

export class FolderApplication implements IFolderApplication {
  private readonly app: IBaseApplication;

  private readonly errors: ApiError[] = [];
  private readonly folders: AcoFolder[] = [];
  private readonly runners: IFolderRunner[];

  public constructor(app: IBaseApplication) {
    this.app = app;
    this.runners = [folderRunnerFactory(this.app)];
  }

  public getFolders(app: string | null = null): AcoFolder[] {
    if (!app) {
      return this.folders;
    }
    return this.folders.filter((folder) => folder.type === app);
  }

  public getErrors(): ApiError[] {
    return this.errors;
  }

  public async run(): Promise<void> {
    const skip = this.app.getStringArg("skip", "").split(",");
    for (const runner of this.runners) {
      logger.info(`Creating "${runner.name}" folders...`);
      if (skip.includes(`folder:${runner.id}`)) {
        logger.info(`Skipping runner "${runner.name}".`);
        continue;
      }
      const result = await runner.exec();
      logger.info(`${result.total} folders created.`);
      if (result.errors.length > 0) {
        logger.info(`${result.errors.length} errors occurred.`);
      }
      this.addResult(result);
    }
  }

  public async createViaGraphQL(
    variables: AcoFolderCreateParams[],
    atOnce = 10,
  ): Promise<IFolderApplicationCreateViaGraphQLResponse> {
    const mutation = this.createGraphQLMutation();

    const results = await this.app.graphql.mutations<AcoFolder>({
      mutation,
      path: "/graphql",
      variables: variables.map((data) => {
        return {
          data,
        };
      }),
      atOnce,
      getResult: getAcoFolderResult,
    });

    const folders: AcoFolder[] = [];
    const errors: ApiError[] = [];
    for (const result of results) {
      if (result.error) {
        errors.push(result.error);
        continue;
      } else if (!result.data) {
        continue;
      }
      folders.push(result.data);
    }

    return {
      folders,
      errors,
    };
  }

  private createGraphQLMutation(): string {
    return `
            mutation CreateAcoFolder($data: FolderCreateInput!) {
                aco {
                    data: createFolder(data: $data) {
                        data {
                            id
                            title
                            slug
                            type
                            parentId
                        }
                        error {
                            message
                            code
                            data
                        }
                    }
                }
            }
        `;
  }

  private addResult(result: IFolderRunnerResponse): void {
    this.folders.push(...result.folders);
    this.errors.push(...result.errors);
  }
}
