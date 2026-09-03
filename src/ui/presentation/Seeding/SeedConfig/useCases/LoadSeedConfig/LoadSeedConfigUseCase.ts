import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { LoadSeedConfigUseCase as Abstraction } from "./abstractions/LoadSeedConfigUseCase.js";

class LoadSeedConfigUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
  ) {}

  public async execute(projectId: string): Promise<Result<Abstraction.Output, HTTPError>> {
    const [tenantsResult, modelsResult] = await Promise.all([
      this.tenantsGateway.listForProject(projectId),
      this.modelsGateway.listModels(projectId),
    ]);

    if (tenantsResult.isFail()) {
      return Result.fail(tenantsResult.error);
    }

    if (modelsResult.isFail()) {
      return Result.fail(modelsResult.error);
    }

    return Result.ok({
      tenants: tenantsResult.value,
      models: modelsResult.value,
    });
  }
}

export const LoadSeedConfigUseCase = Abstraction.createImplementation({
  implementation: LoadSeedConfigUseCaseImpl,
  dependencies: [TenantsGateway, ModelsGateway],
});
