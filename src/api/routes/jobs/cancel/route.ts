import { cancelJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const cancelJob = routeFactory(cancelJobRoute, async ({ params, container, send }) => {
  const jobWorker = container.resolve(JobWorker);
  await jobWorker.cancelJob(params.jobId);
  const job = await jobWorker.getJob(params.jobId);
  if (!job) {
    return send.error(new JobNotFoundError(params.jobId));
  }
  return send.one("job", job);
});
