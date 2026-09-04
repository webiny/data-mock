import { cancelJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const cancelJob = routeFactory(cancelJobRoute, async ({ params, container, send }) => {
  const jobWorker = container.resolve(JobWorker);
  const job = await jobWorker.getJob(params.jobId);
  if (!job || job.projectId !== params.projectId) {
    return send.error(new JobNotFoundError(params.jobId));
  }
  await jobWorker.cancelJob(params.jobId);
  const updated = await jobWorker.getJob(params.jobId);
  return send.one("job", updated ?? job);
});
