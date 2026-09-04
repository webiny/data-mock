import { CleanupJobExecutor as Abstraction } from "./abstractions/CleanupJobExecutor.js";
import { CleanupService } from "~/shared/node/features/seeding/cleanup/abstractions/CleanupService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class CleanupJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "cleanup";

  public constructor(private readonly cleanupService: CleanupService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    context.appendLog(`Cleaning up entries for project ${context.projectId}`);

    const config = context.configJson ? (JSON.parse(context.configJson) as { jobId?: string }) : {};
    const input: CleanupService.Input = {
      projectId: context.projectId,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    };
    if (config.jobId) {
      input.jobId = config.jobId;
    }
    const result = await this.cleanupService.execute(input);

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Deleted ${result.value.deleted} entries, ${result.value.errors} errors.`);
  }
}

export const CleanupJobExecutor = Abstraction.createImplementation({
  implementation: CleanupJobExecutorImpl,
  dependencies: [CleanupService],
});
