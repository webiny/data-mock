import { getGlobalJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * The project-scoped `GET .../jobs/:jobId` checks the job belongs to that project, which a job
 * with no project of its own can never satisfy.
 */
export const getGlobalJob = routeFactory(getGlobalJobRoute, async ({ params, container, send }) => {
  const job = await container.resolve(JobWorker).getJob(params.jobId);
  if (!job) {
    return send.error(new JobNotFoundError(params.jobId));
  }
  return send.one("job", job);
});
