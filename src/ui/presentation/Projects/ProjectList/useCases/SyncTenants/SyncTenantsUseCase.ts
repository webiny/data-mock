import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { SyncTenantsUseCase as Abstraction } from "./abstractions/SyncTenantsUseCase.js";
import { LoadTenantsUseCase } from "../LoadTenants/abstractions/LoadTenantsUseCase.js";

class SyncTenantsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly loadTenantsUseCase: LoadTenantsUseCase.Interface,
  ) {}

  public async execute(projectId: string): Promise<void> {
    const syncResult = await this.tenantsGateway.syncForProject(projectId);
    if (syncResult.isOk()) {
      await this.loadTenantsUseCase.execute(projectId);
    }
  }
}

export const SyncTenantsUseCase = Abstraction.createImplementation({
  implementation: SyncTenantsUseCaseImpl,
  dependencies: [TenantsGateway, LoadTenantsUseCase],
});
