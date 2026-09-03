import type { Result } from "@webiny/stdlib";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { GetProjectUseCase as Abstraction } from "./abstractions/GetProjectUseCase.js";
import type { Project } from "~/shared/types.js";

class GetProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly projectRepository: ProjectRepository.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    return this.projectRepository.getById(input.id);
  }
}

export const GetProjectUseCase = Abstraction.createImplementation({
  implementation: GetProjectUseCaseImpl,
  dependencies: [ProjectRepository],
});
