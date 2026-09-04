import { Result } from "@webiny/stdlib";
import { inArray, eq } from "drizzle-orm";
import { projectFiles, projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListLocalImagesService } from "../picsum/abstractions/ListLocalImagesService.js";
import { ListLocalFilesService as Abstraction } from "./abstractions/ListLocalFilesService.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type {
  ILocalFileProjectStatus,
  ILocalFileWithStatus,
} from "./abstractions/ListLocalFilesService.js";

class ListLocalFilesServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly listLocalImagesService: ListLocalImagesService.Interface,
    private readonly databaseClient: DatabaseClient.Interface,
  ) {}

  public async execute(
    _input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const localImagesResult = await this.listLocalImagesService.execute({});
    if (localImagesResult.isFail()) {
      return Result.fail(localImagesResult.error);
    }
    const localImages = localImagesResult.value.files;

    if (localImages.length === 0) {
      return Result.ok({ files: [] });
    }

    try {
      const fileNames = localImages.map((image) => image.fileName);

      const rows = this.databaseClient.db
        .select({
          fileName: projectFiles.fileName,
          projectId: projectFiles.projectId,
          projectName: projects.name,
        })
        .from(projectFiles)
        .innerJoin(projects, eq(projectFiles.projectId, projects.id))
        .where(inArray(projectFiles.fileName, fileNames))
        .all();

      const statusByFileName = new Map<string, Map<string, ILocalFileProjectStatus>>();
      for (const row of rows) {
        const perFile =
          statusByFileName.get(row.fileName) ?? new Map<string, ILocalFileProjectStatus>();
        perFile.set(row.projectId, { projectId: row.projectId, projectName: row.projectName });
        statusByFileName.set(row.fileName, perFile);
      }

      const files: ILocalFileWithStatus[] = localImages.map((image) => ({
        fileName: image.fileName,
        fileType: image.fileType,
        fileSize: image.fileSize,
        uploadedToProjects: Array.from(statusByFileName.get(image.fileName)?.values() ?? []),
      }));

      return Result.ok({ files });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListLocalFilesService = Abstraction.createImplementation({
  implementation: ListLocalFilesServiceImpl,
  dependencies: [ListLocalImagesService, DatabaseClient],
});
