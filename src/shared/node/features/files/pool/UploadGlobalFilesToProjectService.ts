import { Result } from "@webiny/stdlib";
import { ListProjectFilesRepository } from "~/shared/node/features/files/list/abstractions/ListProjectFilesRepository.js";
import { LoadFilePoolService } from "./abstractions/LoadFilePoolService.js";
import { UploadGlobalFilesToProjectService as Abstraction } from "./abstractions/UploadGlobalFilesToProjectService.js";

class UploadGlobalFilesToProjectServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly listProjectFilesRepository: ListProjectFilesRepository.Interface,
    private readonly loadFilePoolService: LoadFilePoolService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const beforeResult = await this.listProjectFilesRepository.execute({
      projectId: input.projectId,
      tenant: input.tenant,
    });
    if (beforeResult.isFail()) {
      return Result.fail(beforeResult.error);
    }
    const beforeCount = beforeResult.value.length;

    const poolResult = await this.loadFilePoolService.execute({
      projectId: input.projectId,
      tenant: input.tenant,
    });
    if (poolResult.isFail()) {
      return Result.fail(poolResult.error);
    }

    const files = poolResult.value.filePool;
    const uploaded = Math.max(0, files.length - beforeCount);

    return Result.ok({ uploaded, files });
  }
}

export const UploadGlobalFilesToProjectService = Abstraction.createImplementation({
  implementation: UploadGlobalFilesToProjectServiceImpl,
  dependencies: [ListProjectFilesRepository, LoadFilePoolService],
});
