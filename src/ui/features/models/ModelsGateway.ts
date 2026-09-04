import { Result } from "@webiny/stdlib";
import type { ProjectModel, Job, ApiCmsModelField } from "~/shared/types.js";
import { listProjectModelsRoute, syncProjectModelsRoute } from "~/shared/routes/models.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ModelsGateway as Abstraction } from "./abstractions/ModelsGateway.js";

class ModelsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async listModels(projectId: string): Promise<Result<ProjectModel[], HTTPError>> {
    const result = await this.httpClient.request(listProjectModelsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const models: ProjectModel[] = result.value.models.items.map((item) => ({
      ...item,
      plugin: (item as Record<string, unknown>).plugin === true,
      fields: item.fields as ApiCmsModelField[],
    }));

    return Result.ok(models);
  }

  public async pullModels(projectId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(syncProjectModelsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }
}

export const ModelsGateway = Abstraction.createImplementation({
  implementation: ModelsGatewayImpl,
  dependencies: [HTTPClient],
});
