import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase as Abstraction } from "./abstractions/LoadProjectsUseCase.js";

/**
 * Archived projects are loaded too, and the presenter splits them out. One request keeps the
 * archived section in sync without a second round trip when a project is archived or restored.
 */
class LoadProjectsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    const result = await this.gateway.list(true);
    if (result.isOk()) {
      this.repository.setProjects(result.value);
    }
  }
}

export const LoadProjectsUseCase = Abstraction.createImplementation({
  implementation: LoadProjectsUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
