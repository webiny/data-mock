import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { RestoreProjectUseCase as Abstraction } from "./abstractions/RestoreProjectUseCase.js";

class RestoreProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<void> {
    const result = await this.gateway.restore(id);
    if (result.isOk()) {
      this.repository.updateProject(result.value);
    }
  }
}

export const RestoreProjectUseCase = Abstraction.createImplementation({
  implementation: RestoreProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
