import { syncProjectRoute } from "~/shared/routes/environments.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const syncProject = routeFactory(syncProjectRoute, async ({ params, container, send }) => {
  const jobWorker = container.resolve(JobWorker);
  const jobId = await jobWorker.enqueue({
    projectId: params.projectId,
    type: "sync-system",
  });
  const job = await jobWorker.getJob(jobId);
  if (!job) {
    return send.error(new JobNotFoundError(jobId));
  }
  return send.one("job", job, 202);
});
