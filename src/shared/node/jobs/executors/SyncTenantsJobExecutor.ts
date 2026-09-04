import { SyncTenantsJobExecutor as Abstraction } from "./abstractions/SyncTenantsJobExecutor.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SyncTenantsJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "sync-tenants";

  public constructor(private readonly tenantSyncService: TenantSyncService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    context.appendLog(`Syncing tenants for project ${context.projectId}`);

    const result = await this.tenantSyncService.execute({ projectId: context.projectId });
    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Synced ${result.value.synced} tenant(s).`);
  }
}

export const SyncTenantsJobExecutor = Abstraction.createImplementation({
  implementation: SyncTenantsJobExecutorImpl,
  dependencies: [TenantSyncService],
});
