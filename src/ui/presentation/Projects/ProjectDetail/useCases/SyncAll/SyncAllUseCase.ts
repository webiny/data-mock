import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { SyncAllUseCase as Abstraction } from "./abstractions/SyncAllUseCase.js";

class SyncAllUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
  ) {}

  public async execute(input: { projectId: string }): Promise<Abstraction.Result> {
    const errors: string[] = [];

    const [tenantsResult, modelsResult] = await Promise.all([
      this.tenantsGateway.syncForProject(input.projectId),
      this.modelsGateway.syncModels(input.projectId),
    ]);

    let tenantsSynced = false;
    if (tenantsResult.isOk()) {
      const listResult = await this.tenantsGateway.listForProject(input.projectId);
      if (listResult.isOk()) {
        this.tenantsRepository.setTenants(input.projectId, listResult.value);
        tenantsSynced = true;
      }
    } else {
      errors.push(`Tenants: ${tenantsResult.error.message}`);
    }

    let modelsSynced = false;
    if (modelsResult.isOk()) {
      const listResult = await this.modelsGateway.listModels(input.projectId);
      if (listResult.isOk()) {
        this.modelsRepository.setModels(listResult.value);
        modelsSynced = true;
      }
    } else {
      errors.push(`Models: ${modelsResult.error.message}`);
    }

    return { tenants: tenantsSynced, models: modelsSynced, errors };
  }
}

export const SyncAllUseCase = Abstraction.createImplementation({
  implementation: SyncAllUseCaseImpl,
  dependencies: [TenantsGateway, ModelsGateway, TenantsRepository, ModelsRepository],
});
