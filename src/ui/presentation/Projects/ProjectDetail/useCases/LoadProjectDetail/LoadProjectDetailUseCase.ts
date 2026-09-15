import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectDetailUseCase as Abstraction } from "./abstractions/LoadProjectDetailUseCase.js";

class LoadProjectDetailUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
  ) {}

  public async execute(input: { projectId: string }): Promise<Result<void, HTTPError>> {
    const result = await this.projectsGateway.getById(input.projectId);
    if (result.isFail()) {
      return Result.fail(result.error);
    }
    this.projectsRepository.addProject(result.value);
    return Result.ok(undefined);
  }
}

export const LoadProjectDetailUseCase = Abstraction.createImplementation({
  implementation: LoadProjectDetailUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
