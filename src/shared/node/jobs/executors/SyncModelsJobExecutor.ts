import { SyncModelsJobExecutor as Abstraction } from "./abstractions/SyncModelsJobExecutor.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SyncModelsJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "sync-models";

  public constructor(private readonly syncModelsService: SyncModelsService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    context.appendLog(`Syncing models for project ${context.projectId}`);

    const result = await this.syncModelsService.execute({ projectId: context.projectId });
    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(
      `Synced ${result.value.models} model(s) and ${result.value.groups} group(s).`,
    );
  }
}

export const SyncModelsJobExecutor = Abstraction.createImplementation({
  implementation: SyncModelsJobExecutorImpl,
  dependencies: [SyncModelsService],
});
