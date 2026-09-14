import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { LoadTenantsUseCase as Abstraction } from "./abstractions/LoadTenantsUseCase.js";
import type { EnvironmentRef } from "~/shared/types.js";

class LoadTenantsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
  ) {}

  public async execute(ref: EnvironmentRef): Promise<void> {
    const result = await this.tenantsGateway.listForProject(ref);
    if (result.isOk()) {
      this.tenantsRepository.setTenants(ref.environmentId, result.value);
    }
  }
}

export const LoadTenantsUseCase = Abstraction.createImplementation({
  implementation: LoadTenantsUseCaseImpl,
  dependencies: [TenantsGateway, TenantsRepository],
});
