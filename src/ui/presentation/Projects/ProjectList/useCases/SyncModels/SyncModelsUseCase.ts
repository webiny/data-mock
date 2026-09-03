import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { SyncModelsUseCase as Abstraction } from "./abstractions/SyncModelsUseCase.js";

class SyncModelsUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly modelsGateway: ModelsGateway.Interface) {}

  public async execute(projectId: string): Promise<void> {
    await this.modelsGateway.syncModels(projectId);
  }
}

export const SyncModelsUseCase = Abstraction.createImplementation({
  implementation: SyncModelsUseCaseImpl,
  dependencies: [ModelsGateway],
});
