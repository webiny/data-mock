import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { ArchiveProjectUseCase as Abstraction } from "./abstractions/ArchiveProjectUseCase.js";

/**
 * Archiving keeps the project in the repository — it moves to the archived section rather than
 * disappearing, so the restore path stays one click away.
 */
class ArchiveProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<Result<void, HTTPError>> {
    const result = await this.gateway.archive(id);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.repository.updateProject(result.value);
    return Result.ok(undefined);
  }
}

export const ArchiveProjectUseCase = Abstraction.createImplementation({
  implementation: ArchiveProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
