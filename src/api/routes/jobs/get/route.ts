import { getJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getJob = routeFactory(getJobRoute, async ({ params, container, send }) => {
  const jobWorker = container.resolve(JobWorker);
  const job = await jobWorker.getJob(params.jobId);
  if (!job) {
    return send.error(new JobNotFoundError(params.jobId));
  }
  return send.one("job", job);
});
