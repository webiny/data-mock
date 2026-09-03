import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.js";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, HTTPError>> {
    const result = await this.gateway.create(input);
    if (result.isOk()) {
      this.repository.addProject(result.value);
    }
    return result;
  }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
  implementation: CreateProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
