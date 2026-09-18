import { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { LoadSeedConfigUseCase as Abstraction } from "./abstractions/LoadSeedConfigUseCase.js";
import type { EnvironmentRef } from "~/shared/types.js";

class LoadSeedConfigUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
  ) {}

  public async execute(ref: EnvironmentRef): Promise<Result<Abstraction.Output, HTTPError>> {
    const [projectResult, tenantsResult, modelsResult] = await Promise.all([
      this.projectsGateway.getById(ref.projectId),
      this.tenantsGateway.listForProject(ref),
      this.modelsGateway.listModels(ref),
    ]);

    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    if (tenantsResult.isFail()) {
      return Result.fail(tenantsResult.error);
    }

    if (modelsResult.isFail()) {
      return Result.fail(modelsResult.error);
    }

    return Result.ok({
      projectName: projectResult.value.name,
      tenants: tenantsResult.value,
      models: modelsResult.value,
    });
  }
}

export const LoadSeedConfigUseCase = Abstraction.createImplementation({
  implementation: LoadSeedConfigUseCaseImpl,
  dependencies: [ProjectsGateway, TenantsGateway, ModelsGateway],
});
