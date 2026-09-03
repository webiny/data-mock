import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { LoadTenantsUseCase as Abstraction } from "./abstractions/LoadTenantsUseCase.js";

class LoadTenantsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
  ) {}

  public async execute(projectId: string): Promise<void> {
    const result = await this.tenantsGateway.listForProject(projectId);
    if (result.isOk()) {
      this.tenantsRepository.setTenants(projectId, result.value);
    }
  }
}

export const LoadTenantsUseCase = Abstraction.createImplementation({
  implementation: LoadTenantsUseCaseImpl,
  dependencies: [TenantsGateway, TenantsRepository],
});
