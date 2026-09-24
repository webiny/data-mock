import { previewProjectSyncRoute } from "~/shared/routes/environments.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Enqueues the read; nothing is stored by it. The sync itself is still started separately, from
 * `POST /api/projects/:projectId/sync`, once the user has seen the diff and accepted it.
 */
export const previewProjectSync = routeFactory(
  previewProjectSyncRoute,
  async ({ body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);

    const jobId = await jobWorker.enqueue({
      // No project of its own: a preview can cover several, and it writes nothing that the
      // per-project serialization needs to protect.
      projectId: null,
      type: "sync-preview",
      config: { projectIds: body.projectIds },
    });

    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }

    return send.one("job", job, 202);
  },
);
