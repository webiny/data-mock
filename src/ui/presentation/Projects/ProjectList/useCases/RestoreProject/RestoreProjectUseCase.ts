import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { RestoreProjectUseCase as Abstraction } from "./abstractions/RestoreProjectUseCase.js";

class RestoreProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<Result<void, HTTPError>> {
    const result = await this.gateway.restore(id);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.repository.updateProject(result.value);
    return Result.ok(undefined);
  }
}

export const RestoreProjectUseCase = Abstraction.createImplementation({
  implementation: RestoreProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
