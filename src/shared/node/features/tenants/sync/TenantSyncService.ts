import { Result, Logger } from "@webiny/stdlib";
import { EnvironmentContextService } from "~/shared/node/features/environments/context/abstractions/EnvironmentContextService.js";
import { CmsManageEndpointClient } from "~/shared/node/graphql/endpoints/abstractions/CmsManageEndpointClient.js";
import { OperationRegistry } from "~/shared/node/graphql/operations/abstractions/OperationRegistry.js";
import { SyncProjectTenantsRepository } from "./abstractions/SyncProjectTenantsRepository.js";
import { ListProjectTenantsRepository } from "~/shared/node/features/tenants/list/abstractions/ListProjectTenantsRepository.js";
import { TenantSyncService as Abstraction } from "./abstractions/TenantSyncService.js";
import type { ITenantSyncDiff } from "./abstractions/TenantSyncService.js";
import type { OperationLog } from "~/shared/types.js";

class TenantSyncServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly environmentContextService: EnvironmentContextService.Interface,
    private readonly cmsManageClient: CmsManageEndpointClient.Interface,
    private readonly operationRegistry: OperationRegistry.Interface,
    private readonly syncProjectTenantsRepository: SyncProjectTenantsRepository.Interface,
    private readonly listProjectTenantsRepository: ListProjectTenantsRepository.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const contextResult = await this.environmentContextService.execute({
      environmentId: input.environmentId,
    });

    if (contextResult.isFail()) {
      return Result.fail(contextResult.error);
    }

    const { project, environment, apiUrl, apiToken, tenant, operationsVersion } =
      contextResult.value;

    const operation = this.operationRegistry.resolve<void, Array<{ id: string; name: string }>>(
      "listTenants",
      operationsVersion,
    );

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      authorization: `Bearer ${apiToken}`,
      "x-tenant": tenant,
    };

    let tenants: Array<{ tenantId: string; name: string }>;
    const operations: OperationLog[] = [];
    const url = `${apiUrl}${operation.path}`;
    const onProgress = input.onProgress;

    onProgress?.(20, "Fetching tenants...");

    try {
      const response = await this.cmsManageClient.post(
        apiUrl,
        JSON.stringify({ query: operation.query }),
        headers,
      );

      if (response.status !== 200) {
        const text = await response.text().catch(() => "");
        operations.push({
          name: "listTenants",
          url,
          query: operation.query.trim(),
          httpStatus: response.status,
          response: text,
        });
        this.logger.warn(
          `Could not list tenants for project "${project.name}": HTTP ${response.status}. Storing default tenant only.`,
        );
        tenants = [{ tenantId: tenant, name: tenant }];
      } else {
        const json = (await response.json()) as Record<string, unknown>;
        operations.push({
          name: "listTenants",
          url,
          query: operation.query.trim(),
          httpStatus: response.status,
          response: json,
        });

        const gqlResult = operation.getResult({
          data: (json["data"] ?? {}) as Record<string, unknown>,
        });

        if (gqlResult.data) {
          tenants = gqlResult.data.map((t) => ({ tenantId: t.id, name: t.name }));
          if (!tenants.some((t) => t.tenantId === tenant)) {
            tenants.unshift({ tenantId: tenant, name: tenant });
          }
          this.logger.info(`Discovered ${tenants.length} tenant(s) for project "${project.name}".`);
        } else {
          this.logger.warn(
            `Could not list tenants for project "${project.name}": ${gqlResult.error?.message ?? "Unknown error"}. Storing default tenant only.`,
          );
          tenants = [{ tenantId: tenant, name: tenant }];
        }
      }
    } catch (error) {
      operations.push({
        name: "listTenants",
        url,
        query: operation.query.trim(),
        httpStatus: 0,
        response: error instanceof Error ? error.message : String(error),
      });
      this.logger.warn(
        `Could not list tenants for project "${project.name}": ${error instanceof Error ? error.message : "Unknown error"}. Storing default tenant only.`,
      );
      tenants = [{ tenantId: tenant, name: tenant }];
    }

    const existingResult = await this.listProjectTenantsRepository.execute({
      environmentId: environment.id,
    });

    const existingTenantIds = new Set(
      existingResult.isOk() ? existingResult.value.map((t) => t.tenantId) : [],
    );
    const newTenantIds = new Set(tenants.map((t) => t.tenantId));

    const diff: ITenantSyncDiff = {
      added: tenants.filter((t) => !existingTenantIds.has(t.tenantId)),
      removed: existingResult.isOk()
        ? existingResult.value
            .filter((t) => !newTenantIds.has(t.tenantId))
            .map((t) => ({ tenantId: t.tenantId, name: t.name }))
        : [],
      unchanged: tenants.filter((t) => existingTenantIds.has(t.tenantId)),
    };

    onProgress?.(70, "Syncing tenants...");

    const syncResult = await this.syncProjectTenantsRepository.execute({
      projectId: project.id,
      environmentId: environment.id,
      tenants,
    });

    if (syncResult.isFail()) {
      return Result.fail(syncResult.error);
    }

    return Result.ok({ tenants, synced: tenants.length, diff, operations });
  }
}

export const TenantSyncService = Abstraction.createImplementation({
  implementation: TenantSyncServiceImpl,
  dependencies: [
    EnvironmentContextService,
    CmsManageEndpointClient,
    OperationRegistry,
    SyncProjectTenantsRepository,
    ListProjectTenantsRepository,
    Logger,
  ],
});
