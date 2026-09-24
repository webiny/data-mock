import { SyncPreviewJobExecutor as Abstraction } from "./abstractions/SyncPreviewJobExecutor.js";
import { SyncPreviewService } from "~/shared/node/features/webinyCli/sync/preview/abstractions/SyncPreviewService.js";
import { syncPreviewJobConfigSchema } from "~/shared/jobs/descriptors.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import type { SyncPreviewJobResult } from "~/shared/responses/sync.js";

/**
 * Reads what a sync would change, for one project or for many, and leaves the answer on the job.
 *
 * It runs as a job rather than inline because a project on a remote backend is read by asking the
 * Webiny CLI once per app — tens of seconds of child processes, which is not something to hold an
 * HTTP request open for. The dialog enqueues this and reads the result off the row.
 */
class SyncPreviewJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "sync-preview";

  public constructor(private readonly syncPreviewService: SyncPreviewService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const config = syncPreviewJobConfigSchema.parse(
      context.configJson === null ? {} : JSON.parse(context.configJson),
    );

    const result: SyncPreviewJobResult = { previews: [], failures: [] };
    const total = config.projectIds.length;
    let done = 0;

    for (const projectId of config.projectIds) {
      if (context.signal.aborted) {
        break;
      }

      const previewed = await this.syncPreviewService.execute({ projectId });

      if (previewed.isOk()) {
        result.previews.push(previewed.value);
      } else {
        /**
         * One project that cannot be previewed — no checkout, or not a Webiny project — must not
         * take the rest of the batch with it. Syncing every project at once is exactly where a
         * single bad checkout is most likely.
         */
        result.failures.push({ projectId, error: previewed.error.message });
        context.appendLog(`${projectId}: ${previewed.error.message}`);
      }

      done += 1;
      context.setProgress({
        percent: Math.round((done / total) * 100),
        label: `Read ${done} of ${total} project(s)`,
      });
    }

    context.setResult(result);
  }
}

export const SyncPreviewJobExecutor = Abstraction.createImplementation({
  implementation: SyncPreviewJobExecutorImpl,
  dependencies: [SyncPreviewService],
});
