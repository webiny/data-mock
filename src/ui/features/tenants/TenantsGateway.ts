import { Result } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";
import { listProjectTenantsRoute, syncProjectTenantsRoute } from "~/shared/routes/tenants.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { TenantsGateway as Abstraction } from "./abstractions/TenantsGateway.js";

class TenantsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async listForProject(projectId: string): Promise<Result<ProjectTenant[], HTTPError>> {
    const result = await this.httpClient.request(listProjectTenantsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.tenants.items);
  }

  public async syncForProject(
    projectId: string,
  ): Promise<Result<Abstraction.SyncResult, HTTPError>> {
    const result = await this.httpClient.request(syncProjectTenantsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.sync);
  }
}

export const TenantsGateway = Abstraction.createImplementation({
  implementation: TenantsGatewayImpl,
  dependencies: [HTTPClient],
});
