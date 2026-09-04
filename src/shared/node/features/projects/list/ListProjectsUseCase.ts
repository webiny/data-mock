import { Result } from "@webiny/stdlib";
import { ListProjectsRepository } from "./abstractions/ListProjectsRepository.js";
import { ListProjectsUseCase as Abstraction } from "./abstractions/ListProjectsUseCase.js";

class ListProjectsUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly listProjectsRepository: ListProjectsRepository.Interface) {}

  public async execute(): Promise<Result<Abstraction.UseCaseResult, Abstraction.Error>> {
    const result = await this.listProjectsRepository.execute();

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const projects = result.value;
    return Result.ok({ projects, total: projects.length });
  }
}

export const ListProjectsUseCase = Abstraction.createImplementation({
  implementation: ListProjectsUseCaseImpl,
  dependencies: [ListProjectsRepository],
});
