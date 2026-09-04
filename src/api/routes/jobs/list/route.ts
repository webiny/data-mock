import { listJobsRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listJobs = routeFactory(listJobsRoute, async ({ params, query, container, send }) => {
  const jobWorker = container.resolve(JobWorker);
  const jobs = await jobWorker.listJobs(params.projectId, query.status);
  return send.list("jobs", jobs, jobs.length);
});
