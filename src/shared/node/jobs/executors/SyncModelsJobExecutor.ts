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
    context.appendLog(`Syncing models for project ${context.projectId}`);

    const result = await this.syncModelsService.execute({ projectId: context.projectId });

    if (result.isFail()) {
      await this.createSyncLogRepository.execute({
        projectId: context.projectId,
        type: "models",
        status: "error",
        message: result.error.message,
        response: result.error.data,
      });
      throw new Error(result.error.message);
    }

    const { operations, ...summary } = result.value;

    await this.createSyncLogRepository.execute({
      projectId: context.projectId,
      type: "models",
      status: "success",
      message: `Synced ${summary.models} model(s)`,
      request: operations,
      response: summary,
    });

    context.appendLog(
      `Synced ${result.value.models} model(s) and ${result.value.groups} group(s).`,
    );
  }
}

export const SyncModelsJobExecutor = Abstraction.createImplementation({
  implementation: SyncModelsJobExecutorImpl,
  dependencies: [SyncModelsService, CreateSyncLogRepository],
});
