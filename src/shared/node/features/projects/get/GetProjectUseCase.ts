import type { Result } from "@webiny/stdlib";
import { GetProjectRepository } from "./abstractions/GetProjectRepository.js";
import { GetProjectUseCase as Abstraction } from "./abstractions/GetProjectUseCase.js";
import type { Project } from "~/shared/types.js";

class GetProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly getProjectRepository: GetProjectRepository.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    return this.getProjectRepository.execute(input);
  }
}

export const GetProjectUseCase = Abstraction.createImplementation({
  implementation: GetProjectUseCaseImpl,
  dependencies: [GetProjectRepository],
});
