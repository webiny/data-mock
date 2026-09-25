import { SyncModelsJobExecutor as Abstraction } from "./abstractions/SyncModelsJobExecutor.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SyncModelsJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "pull-models";

  public constructor(
    private readonly syncModelsService: SyncModelsService.Interface,
    private readonly createSyncLogRepository: CreateSyncLogRepository.Interface,
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.environmentId) {
      throw new Error("Pull models job requires an environmentId");
    }
    const environmentId = context.environmentId;
    const projectId = context.projectId;

    if (!projectId) {
      throw new Error("Sync job requires a projectId");
    }
    context.appendLog(`Syncing models for environment ${environmentId}`);

    const result = await this.syncModelsService.execute({
      environmentId,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      await this.createSyncLogRepository.execute({
        projectId,
        environmentId,
        type: "models",
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
      type: "models",
      status: "success",
      message: `Synced ${summary.models} model(s) across ${summary.tenants.length} tenant(s)`,
      request: operations,
      response: summary,
    });

    for (const tenant of result.value.tenants) {
      context.appendLog(
        tenant.error === null
          ? `[${tenant.tenant}] Synced ${tenant.models} model(s) and ${tenant.groups} group(s).`
          : `[${tenant.tenant}] Failed: ${tenant.error}`,
      );
    }
  }
}

export const SyncModelsJobExecutor = Abstraction.createImplementation({
  implementation: SyncModelsJobExecutorImpl,
  dependencies: [SyncModelsService, CreateSyncLogRepository],
});
