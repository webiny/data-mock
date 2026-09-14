import { SyncSystemJobExecutor as Abstraction } from "./abstractions/SyncSystemJobExecutor.js";
import { SyncSystemService } from "~/shared/node/features/webinyCli/sync/abstractions/SyncSystemService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SyncSystemJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "sync-system";

  public constructor(private readonly syncSystemService: SyncSystemService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    // Project-scoped, not environment-scoped: syncing is what discovers the environments.
    if (!context.projectId) {
      throw new Error("Sync system job requires a projectId");
    }

    const result = await this.syncSystemService.execute({
      projectId: context.projectId,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    const summary = result.value;

    for (const message of summary.messages) {
      context.appendLog(message);
    }

    context.appendLog(
      `Version: ${summary.webinyVersion ?? "workspace root (built from source)"}` +
        (summary.versionMajor === null ? "" : ` (v${summary.versionMajor})`),
    );
    context.appendLog(
      `Environments: ${summary.environmentsFound} found, ${summary.environmentsDeployed} deployed.`,
    );

    if (summary.stacksUnknown > 0) {
      // Worth calling out: those stacks kept their previously stored output rather than being
      // cleared, so the inventory is stale for them rather than wrong.
      context.appendLog(
        `${summary.stacksUnknown} stack(s) could not be read; their stored output was left unchanged.`,
      );
    }
  }
}

export const SyncSystemJobExecutor = Abstraction.createImplementation({
  implementation: SyncSystemJobExecutorImpl,
  dependencies: [SyncSystemService],
});
