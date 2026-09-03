import { Result } from "@webiny/stdlib";
import { CreateProjectRepository } from "./abstractions/CreateProjectRepository.js";
import { CreateProjectUseCase as Abstraction } from "./abstractions/CreateProjectUseCase.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";
import { ValidationError } from "~/shared/errors.js";
import type { Project } from "~/shared/types.js";

class CreateProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly createProjectRepository: CreateProjectRepository.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    const parsed = createProjectBodySchema.safeParse(input);

    if (!parsed.success) {
      return Result.fail(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input"));
    }

    return this.createProjectRepository.execute(parsed.data);
  }
}

export const CreateProjectUseCase = Abstraction.createImplementation({
  implementation: CreateProjectUseCaseImpl,
  dependencies: [CreateProjectRepository],
});
