import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { SyncProjectTenantsRepository } from "./abstractions/SyncProjectTenantsRepository.js";
import { TenantSyncService as Abstraction } from "./abstractions/TenantSyncService.js";
import { GraphQLRequestError } from "~/shared/errors.js";

interface WebinyTenant {
  id: string;
  name: string;
}

class TenantSyncServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly syncProjectTenantsRepository: SyncProjectTenantsRepository.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const projectResult = await this.getProjectRepository.execute({ id: input.projectId });

    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }

    const project = projectResult.value;

    const tenantsResult = await this.fetchTenants(project.apiUrl, project.apiToken, project.tenant);

    let tenants: Array<{ tenantId: string; name: string }>;

    if (tenantsResult.isOk()) {
      tenants = tenantsResult.value;
      this.logger.info(`Discovered ${tenants.length} tenant(s) for project "${project.name}".`);
    } else {
      this.logger.warn(
        `Could not list tenants for project "${project.name}": ${tenantsResult.error.message}. Storing default tenant only.`,
      );
      tenants = [{ tenantId: project.tenant, name: project.tenant }];
    }

    const syncResult = await this.syncProjectTenantsRepository.execute({
      projectId: project.id,
      tenants,
    });

    if (syncResult.isFail()) {
      return Result.fail(syncResult.error);
    }

    return Result.ok({ tenants, synced: tenants.length });
  }

  private async fetchTenants(
    apiUrl: string,
    token: string,
    tenant: string,
  ): Promise<Result<Array<{ tenantId: string; name: string }>, GraphQLRequestError>> {
    const query = `{ tenancy { listTenants { data { id name } } } }`;

    try {
      const response = await this.httpClient.post(
        `${apiUrl.replace(/\/cms\/manage$/, "")}/graphql`,
        JSON.stringify({ query }),
        {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
          "x-tenant": tenant,
        },
      );

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        return Result.fail(
          new GraphQLRequestError(
            `Tenant list request failed with status ${response.status}`,
            response.status,
            text,
          ),
        );
      }

      const json = (await response.json()) as {
        data?: { tenancy?: { listTenants?: { data?: WebinyTenant[] } } };
        errors?: Array<{ message: string }>;
      };

      if (json.errors && json.errors.length > 0) {
        return Result.fail(
          new GraphQLRequestError(json.errors[0]?.message ?? "GraphQL error listing tenants", 200),
        );
      }

      const data = json.data?.tenancy?.listTenants?.data;

      if (!data) {
        return Result.fail(new GraphQLRequestError("Tenant listing not available", 200));
      }

      return Result.ok(data.map((t) => ({ tenantId: t.id, name: t.name })));
    } catch (error) {
      return Result.fail(
        new GraphQLRequestError(
          error instanceof Error ? error.message : "Failed to fetch tenants",
          0,
        ),
      );
    }
  }
}

export const TenantSyncService = Abstraction.createImplementation({
  implementation: TenantSyncServiceImpl,
  dependencies: [GetProjectRepository, HttpClient, SyncProjectTenantsRepository, Logger],
});
