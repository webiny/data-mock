import { Result, Logger } from "@webiny/stdlib";
import { ListProjectFilesRepository } from "~/shared/node/features/files/list/abstractions/ListProjectFilesRepository.js";
import { ListLocalImagesService } from "~/shared/node/features/files/picsum/abstractions/ListLocalImagesService.js";
import { FileUploadService } from "~/shared/node/features/files/upload/abstractions/FileUploadService.js";
import { LoadFilePoolService } from "./abstractions/LoadFilePoolService.js";
import { UploadGlobalFilesToProjectService as Abstraction } from "./abstractions/UploadGlobalFilesToProjectService.js";
import type { ProjectFile } from "~/shared/types.js";

const ALL_FILES_LIMIT = 100000;

class UploadGlobalFilesToProjectServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly listProjectFilesRepository: ListProjectFilesRepository.Interface,
    private readonly listLocalImagesService: ListLocalImagesService.Interface,
    private readonly fileUploadService: FileUploadService.Interface,
    private readonly loadFilePoolService: LoadFilePoolService.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    if (input.fileNames && input.fileNames.length > 0) {
      return this.uploadSelected(input);
    }
    return this.uploadAll(input);
  }

  private async uploadAll(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const beforeResult = await this.listProjectFilesRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      limit: ALL_FILES_LIMIT,
    });
    if (beforeResult.isFail()) {
      return Result.fail(beforeResult.error);
    }
    const beforeCount = beforeResult.value.total;

    const poolResult = await this.loadFilePoolService.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      onProgress: input.onProgress,
    });
    if (poolResult.isFail()) {
      return Result.fail(poolResult.error);
    }

    const files = poolResult.value.filePool;
    const uploaded = Math.max(0, files.length - beforeCount);

    return Result.ok({ uploaded, files });
  }

  private async uploadSelected(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const requestedNames = new Set(input.fileNames);

    const dbFilesResult = await this.listProjectFilesRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
      limit: ALL_FILES_LIMIT,
    });
    if (dbFilesResult.isFail()) {
      return Result.fail(dbFilesResult.error);
    }
    const existingNames = new Set(dbFilesResult.value.files.map((f) => f.fileName));

    const localResult = await this.listLocalImagesService.execute({});
    if (localResult.isFail()) {
      return Result.fail(localResult.error);
    }

    const toUpload = localResult.value.files.filter(
      (f) => requestedNames.has(f.fileName) && !existingNames.has(f.fileName),
    );

    const uploaded: ProjectFile[] = [];
    let uploadIndex = 0;
    for (const localFile of toUpload) {
      uploadIndex++;
      if (input.onProgress) {
        const percent = Math.round((uploadIndex / toUpload.length) * 100);
        input.onProgress(percent, `Uploading: ${uploadIndex}/${toUpload.length} files`);
      }

      try {
        const result = await this.fileUploadService.execute({
          projectId: input.projectId,
          tenant: input.tenant,
          filePath: localFile.filePath,
        });
        if (result.isOk()) {
          uploaded.push(result.value.file);
        } else {
          this.logger.warn(`Failed to upload "${localFile.fileName}": ${result.error.message}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to upload "${localFile.fileName}": ${msg}`);
      }
    }

    const allFiles = [...dbFilesResult.value.files, ...uploaded];
    return Result.ok({ uploaded: uploaded.length, files: allFiles });
  }
}

export const UploadGlobalFilesToProjectService = Abstraction.createImplementation({
  implementation: UploadGlobalFilesToProjectServiceImpl,
  dependencies: [
    ListProjectFilesRepository,
    ListLocalImagesService,
    FileUploadService,
    LoadFilePoolService,
    Logger,
  ],
});
