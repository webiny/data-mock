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
    context.appendLog(`Syncing tenants for project ${context.projectId}`);

    const result = await this.tenantSyncService.execute({ projectId: context.projectId });

    if (result.isFail()) {
      await this.createSyncLogRepository.execute({
        projectId: context.projectId,
        type: "tenants",
        status: "error",
        message: result.error.message,
        response: result.error.data,
      });
      throw new Error(result.error.message);
    }

    const { operations, ...summary } = result.value;

    await this.createSyncLogRepository.execute({
      projectId: context.projectId,
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
