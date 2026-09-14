import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { SyncTenantsUseCase as Abstraction } from "./abstractions/SyncTenantsUseCase.js";
import { LoadTenantsUseCase } from "../LoadTenants/abstractions/LoadTenantsUseCase.js";
import type { EnvironmentRef } from "~/shared/types.js";

class SyncTenantsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly loadTenantsUseCase: LoadTenantsUseCase.Interface,
  ) {}

  public async execute(ref: EnvironmentRef): Promise<void> {
    const syncResult = await this.tenantsGateway.syncForProject(ref);
    if (syncResult.isOk()) {
      await this.loadTenantsUseCase.execute(ref);
    }
  }
}

export const SyncTenantsUseCase = Abstraction.createImplementation({
  implementation: SyncTenantsUseCaseImpl,
  dependencies: [TenantsGateway, LoadTenantsUseCase],
});
