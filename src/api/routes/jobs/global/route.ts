import { listGlobalJobsRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { parseListQuery, getStringFilter } from "~/api/routing/parseListQuery.js";

export const listGlobalJobs = routeFactory(
  listGlobalJobsRoute,
  async ({ query, container, send }) => {
    const { limit, offset, sortField, sortDir } = parseListQuery(query);

    const input: JobWorker.ListJobsInput = { limit, offset, sortDir };
    if (sortField) {
      input.sortField = sortField;
    }
    const status = getStringFilter(query, "status");
    if (status) {
      input.status = status;
    }
    const type = getStringFilter(query, "type");
    if (type) {
      input.type = type;
    }

    const jobWorker = container.resolve(JobWorker);
    const { jobs, total } = await jobWorker.listJobs(input);

    return send.list("jobs", jobs, total);
  },
);
