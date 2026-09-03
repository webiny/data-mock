import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase as Abstraction } from "./abstractions/LoadProjectsUseCase.js";

class LoadProjectsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    const result = await this.gateway.list();
    if (result.isOk()) {
      this.repository.setProjects(result.value);
    }
  }
}

export const LoadProjectsUseCase = Abstraction.createImplementation({
  implementation: LoadProjectsUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
