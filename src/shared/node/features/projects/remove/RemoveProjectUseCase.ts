import type { Result } from "@webiny/stdlib";
import { RemoveProjectRepository } from "./abstractions/RemoveProjectRepository.js";
import { RemoveProjectUseCase as Abstraction } from "./abstractions/RemoveProjectUseCase.js";

class RemoveProjectUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly removeProjectRepository: RemoveProjectRepository.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    return this.removeProjectRepository.execute(input);
  }
}

export const RemoveProjectUseCase = Abstraction.createImplementation({
  implementation: RemoveProjectUseCaseImpl,
  dependencies: [RemoveProjectRepository],
});
