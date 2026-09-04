import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectDetailUseCase as Abstraction } from "./abstractions/LoadProjectDetailUseCase.js";

class LoadProjectDetailUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
  ) {}

  public async execute(input: { projectId: string }): Promise<void> {
    const result = await this.projectsGateway.getById(input.projectId);
    if (result.isOk()) {
      this.projectsRepository.addProject(result.value);
    }
  }
}

export const LoadProjectDetailUseCase = Abstraction.createImplementation({
  implementation: LoadProjectDetailUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
