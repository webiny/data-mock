import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { PurgeProjectUseCase as Abstraction } from "./abstractions/PurgeProjectUseCase.js";

/** Irreversible: the project and every row that cascades from it are gone after this. */
class PurgeProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: ProjectsGateway.Interface,
    private readonly repository: ProjectsRepository.Interface,
  ) {}

  public async execute(id: string): Promise<void> {
    const result = await this.gateway.purge(id);
    if (result.isOk()) {
      this.repository.removeProject(id);
    }
  }
}

export const PurgeProjectUseCase = Abstraction.createImplementation({
  implementation: PurgeProjectUseCaseImpl,
  dependencies: [ProjectsGateway, ProjectsRepository],
});
