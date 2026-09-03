import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { SyncProjectTenantsRepository } from "./abstractions/SyncProjectTenantsRepository.js";
import { TenantSyncService as Abstraction } from "./abstractions/TenantSyncService.js";

class TenantSyncServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly httpClient: HttpClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
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
    const operation = this.operationRegistry.resolve<void, Array<{ id: string; name: string }>>(
      "listTenants",
      project.webinyVersion,
    );

    const baseUrl = project.apiUrl.replace(/\/cms\/manage$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${project.apiToken}`,
      "x-tenant": project.tenant,
    };

    let tenants: Array<{ tenantId: string; name: string }>;

    try {
      const response = await this.httpClient.post(
        `${baseUrl}${operation.path}`,
        JSON.stringify({ query: operation.query }),
        headers,
      );

      if (response.status !== 200) {
        this.logger.warn(
          `Could not list tenants for project "${project.name}": HTTP ${response.status}. Storing default tenant only.`,
        );
        tenants = [{ tenantId: project.tenant, name: project.tenant }];
      } else {
        const json = (await response.json()) as Record<string, unknown>;
        const gqlResult = operation.getResult({
          data: (json["data"] ?? {}) as Record<string, unknown>,
        });

        if (gqlResult.data) {
          tenants = gqlResult.data.map((t) => ({ tenantId: t.id, name: t.name }));
          this.logger.info(`Discovered ${tenants.length} tenant(s) for project "${project.name}".`);
        } else {
          this.logger.warn(
            `Could not list tenants for project "${project.name}": ${gqlResult.error?.message ?? "Unknown error"}. Storing default tenant only.`,
          );
          tenants = [{ tenantId: project.tenant, name: project.tenant }];
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not list tenants for project "${project.name}": ${error instanceof Error ? error.message : "Unknown error"}. Storing default tenant only.`,
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
}

export const TenantSyncService = Abstraction.createImplementation({
  implementation: TenantSyncServiceImpl,
  dependencies: [
    GetProjectRepository,
    HttpClient,
    OperationRegistry,
    SyncProjectTenantsRepository,
    Logger,
  ],
});
