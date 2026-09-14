import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { SyncModelsUseCase as Abstraction } from "./abstractions/SyncModelsUseCase.js";
import type { EnvironmentRef } from "~/shared/types.js";

class SyncModelsUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly modelsGateway: ModelsGateway.Interface) {}

  public async execute(ref: EnvironmentRef): Promise<void> {
    await this.modelsGateway.pullModels(ref);
  }
}

export const SyncModelsUseCase = Abstraction.createImplementation({
  implementation: SyncModelsUseCaseImpl,
  dependencies: [ModelsGateway],
});
