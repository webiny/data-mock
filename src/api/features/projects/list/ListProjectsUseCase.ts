import { Result } from "@webiny/stdlib";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { ListProjectsUseCase as Abstraction } from "./abstractions/ListProjectsUseCase.js";

class ListProjectsUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly projectRepository: ProjectRepository.Interface) {}

  public async execute(): Promise<Result<Abstraction.UseCaseResult, Abstraction.Error>> {
    const result = await this.projectRepository.list();

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const projects = result.value;
    return Result.ok({ projects, total: projects.length });
  }
}

export const ListProjectsUseCase = Abstraction.createImplementation({
  implementation: ListProjectsUseCaseImpl,
  dependencies: [ProjectRepository],
});
