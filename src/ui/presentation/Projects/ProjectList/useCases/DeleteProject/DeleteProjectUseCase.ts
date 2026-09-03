import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { DeleteProjectUseCase as Abstraction } from "./abstractions/DeleteProjectUseCase.js";

class DeleteProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<void> {
    const result = await this.gateway.remove(id);
    if (result.isOk()) {
      this.repository.removeProject(id);
    }
  }
}

export const DeleteProjectUseCase = Abstraction.createImplementation({
  implementation: DeleteProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
