import { SyncTenantsJobExecutor as Abstraction } from "./abstractions/SyncTenantsJobExecutor.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SyncTenantsJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "pull-tenants";

  public constructor(
    private readonly tenantSyncService: TenantSyncService.Interface,
    private readonly createSyncLogRepository: CreateSyncLogRepository.Interface,
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.environmentId) {
      throw new Error("Pull tenants job requires an environmentId");
    }
    const environmentId = context.environmentId;
    const projectId = context.projectId;

    if (!projectId) {
      throw new Error("Sync job requires a projectId");
    }
    context.appendLog(`Syncing tenants for environment ${environmentId}`);

    const result = await this.tenantSyncService.execute({
      environmentId,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      await this.createSyncLogRepository.execute({
        projectId,
        environmentId,
        type: "tenants",
        status: "error",
        message: result.error.message,
        response: result.error.data,
      });
      throw new Error(result.error.message);
    }

    const { operations, ...summary } = result.value;

    await this.createSyncLogRepository.execute({
      projectId,
      environmentId,
      type: "tenants",
      status: "success",
      message: `Synced ${summary.synced} tenant(s)`,
      request: operations,
      response: summary,
    });

    context.appendLog(`Synced ${result.value.synced} tenant(s).`);
  }
}

export const SyncTenantsJobExecutor = Abstraction.createImplementation({
  implementation: SyncTenantsJobExecutorImpl,
  dependencies: [TenantSyncService, CreateSyncLogRepository],
});
