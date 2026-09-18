import { Result } from "@webiny/stdlib";
import { RemoveProjectRepository } from "./abstractions/RemoveProjectRepository.js";
import { GetProjectRepository } from "../get/abstractions/GetProjectRepository.js";
import { RemoveProjectUseCase as Abstraction } from "./abstractions/RemoveProjectUseCase.js";
import { readSeededProjectNames } from "~/shared/node/seedProjects.js";
import { ValidationError } from "~/shared/errors.js";

/**
 * Permanently deletes a project and everything that hangs off it.
 *
 * A project named by `.projects.json` is refused: the seed file recreates it on the next boot, so
 * the delete would destroy its jobs, logs, entries and models and hand back an empty project of
 * the same name. Removing the entry from that file makes it deletable, with no restart needed.
 */
class RemoveProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly removeProjectRepository: RemoveProjectRepository.Interface,
    private readonly getProjectRepository: GetProjectRepository.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    const project = await this.getProjectRepository.execute({ id: input.id });
    if (project.isFail()) {
      return Result.fail(project.error);
    }

    if (readSeededProjectNames().has(project.value.name)) {
      return Result.fail(
        new ValidationError(
          `"${project.value.name}" is seeded from .projects.json and cannot be deleted. Remove it from that file first.`,
        ),
      );
    }

    return this.removeProjectRepository.execute(input);
  }
}

export const RemoveProjectUseCase = Abstraction.createImplementation({
  implementation: RemoveProjectUseCaseImpl,
  dependencies: [RemoveProjectRepository, GetProjectRepository],
});
