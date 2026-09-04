import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { SyncProjectFilesRepository } from "./abstractions/SyncProjectFilesRepository.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { SyncFilesService as Abstraction } from "./abstractions/SyncFilesService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import type { ISyncFileInput } from "./abstractions/SyncProjectFilesRepository.js";

const LIST_FILES_QUERY = `
  query ListFiles($limit: Int, $after: String) {
    fileManager {
      listFiles(limit: $limit, after: $after) {
        data {
          id
          name
          key
          src
          type
          size
        }
        meta {
          cursor
          hasMoreItems
        }
        error {
          message
          code
        }
      }
    }
  }
`;

interface IFmFile {
  id: string;
  name: string;
  key: string;
  src: string;
  type: string;
  size: number | null;
}

interface IListFilesMeta {
  cursor: string | null;
  hasMoreItems: boolean;
}

interface IListFilesError {
  message: string;
  code: string;
}

interface IListFilesResult {
  data: IFmFile[] | null;
  meta: IListFilesMeta | null;
  error: IListFilesError | null;
}

class SyncFilesServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly syncProjectFilesRepository: SyncProjectFilesRepository.Interface,
    private readonly createSyncLogRepository: CreateSyncLogRepository.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const projectResult = await this.getProjectRepository.execute({ id: input.projectId });
    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    const project = projectResult.value;
    const apiUrl = project.apiUrl.replace(/\/cms\/manage.*$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": input.tenant,
    };

    const allFiles: IFmFile[] = [];
    let cursor: string | null = null;
    let hasMoreItems = true;

    while (hasMoreItems) {
      const response = await this.httpClient.post(
        `${apiUrl}/graphql`,
        JSON.stringify({
          query: LIST_FILES_QUERY,
          variables: { limit: 100, after: cursor },
        }),
        headers,
      );

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        return Result.fail(
          new GraphQLRequestError(
            `Listing files failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as Record<string, unknown>;
      const listFilesResult = extractListFilesResult(json);

      if (listFilesResult.error) {
        return Result.fail(
          new GraphQLRequestError(listFilesResult.error.message, 200, listFilesResult.error),
        );
      }

      allFiles.push(...(listFilesResult.data ?? []));
      cursor = listFilesResult.meta?.cursor ?? null;
      hasMoreItems = listFilesResult.meta?.hasMoreItems ?? false;
    }

    const mapped: ISyncFileInput[] = allFiles.map((file) => ({
      fileKey: file.key,
      fileUrl: file.src,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }));

    const syncResult = await this.syncProjectFilesRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      files: mapped,
    });

    if (syncResult.isFail()) {
      return Result.fail(syncResult.error);
    }

    const syncedCount = syncResult.value.length;

    await this.createSyncLogRepository.execute({
      projectId: input.projectId,
      type: "pull-files",
      status: "success",
      message: `Pulled ${syncedCount} file(s) from File Manager`,
      response: { synced: syncedCount },
    });

    this.logger.info(
      `Pulled ${syncedCount} file(s) for project "${project.name}" (tenant "${input.tenant}").`,
    );

    return Result.ok({ synced: syncedCount, files: syncResult.value });
  }
}

function extractListFilesResult(json: Record<string, unknown>): IListFilesResult {
  const data = json["data"] as Record<string, unknown> | undefined;
  const fileManager = data?.["fileManager"] as Record<string, unknown> | undefined;
  const listFiles = fileManager?.["listFiles"] as Record<string, unknown> | undefined;

  return {
    data: (listFiles?.["data"] as IFmFile[] | undefined) ?? null,
    meta: (listFiles?.["meta"] as IListFilesMeta | undefined) ?? null,
    error: (listFiles?.["error"] as IListFilesError | undefined) ?? null,
  };
}

export const SyncFilesService = Abstraction.createImplementation({
  implementation: SyncFilesServiceImpl,
  dependencies: [
    GetProjectRepository,
    HttpClient,
    SyncProjectFilesRepository,
    CreateSyncLogRepository,
    Logger,
  ],
});
