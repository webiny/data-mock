import { importEntriesRoute } from "~/shared/routes/import.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const importEntries = routeFactory(
  importEntriesRoute,
  async ({ params, body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);
    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      type: "import",
      config: {
        tenant: body.tenant,
        models: body.models,
      },
    });
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 202);
  },
);
