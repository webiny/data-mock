import { Result, Logger } from "@webiny/stdlib";
import { ListProjectFilesRepository } from "~/shared/node/features/files/list/abstractions/ListProjectFilesRepository.js";
import { ListLocalImagesService } from "~/shared/node/features/files/picsum/abstractions/ListLocalImagesService.js";
import { FileUploadService } from "~/shared/node/features/files/upload/abstractions/FileUploadService.js";
import { LoadFilePoolService as Abstraction } from "./abstractions/LoadFilePoolService.js";
import type { ProjectFile } from "~/shared/types.js";

class LoadFilePoolServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly listProjectFilesRepository: ListProjectFilesRepository.Interface,
    private readonly listLocalImagesService: ListLocalImagesService.Interface,
    private readonly fileUploadService: FileUploadService.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const dbFilesResult = await this.listProjectFilesRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
    });
    if (dbFilesResult.isFail()) {
      return Result.fail(dbFilesResult.error);
    }
    const dbFiles = dbFilesResult.value;

    const localImagesResult = await this.listLocalImagesService.execute({});
    if (localImagesResult.isFail()) {
      return Result.fail(localImagesResult.error);
    }
    const localImages = localImagesResult.value.files;

    const uploadedFileNames = new Set(dbFiles.map((file) => file.fileName));
    const newlyUploadedFiles: ProjectFile[] = [];

    for (const localImage of localImages) {
      if (uploadedFileNames.has(localImage.fileName)) {
        continue;
      }

      try {
        const uploadResult = await this.fileUploadService.execute({
          projectId: input.projectId,
          tenant: input.tenant,
          filePath: localImage.filePath,
        });

        if (uploadResult.isFail()) {
          this.logger.warn(
            `Failed to upload local image "${localImage.fileName}" to file pool: ${uploadResult.error.message}`,
          );
          continue;
        }

        newlyUploadedFiles.push(uploadResult.value.file);
      } catch (error) {
        this.logger.warn(
          `Failed to upload local image "${localImage.fileName}" to file pool: ${toError(error).message}`,
        );
      }
    }

    return Result.ok({ filePool: [...dbFiles, ...newlyUploadedFiles] });
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const LoadFilePoolService = Abstraction.createImplementation({
  implementation: LoadFilePoolServiceImpl,
  dependencies: [ListProjectFilesRepository, ListLocalImagesService, FileUploadService, Logger],
});
