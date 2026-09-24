import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { PurgeProjectUseCase as Abstraction } from "./abstractions/PurgeProjectUseCase.js";

/** Irreversible: the project and every row that cascades from it are gone after this. */
class PurgeProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<Result<void, HTTPError>> {
    const result = await this.gateway.purge(id);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.repository.removeProject(id);
    return Result.ok(undefined);
  }
}

export const PurgeProjectUseCase = Abstraction.createImplementation({
  implementation: PurgeProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
