import type { Result } from "@webiny/stdlib";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { RemoveProjectUseCase as Abstraction } from "./abstractions/RemoveProjectUseCase.js";

class RemoveProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly projectRepository: ProjectRepository.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    return this.projectRepository.remove(input.id);
  }
}

export const RemoveProjectUseCase = Abstraction.createImplementation({
  implementation: RemoveProjectUseCaseImpl,
  dependencies: [ProjectRepository],
});
