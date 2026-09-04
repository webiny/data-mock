import { cleanupEntriesRoute } from "~/shared/routes/cleanup.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const cleanupEntries = routeFactory(
  cleanupEntriesRoute,
  async ({ params, body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);
    const input: JobWorker.CreateJobInput = {
      projectId: params.projectId,
      type: "cleanup",
    };
    if (body?.jobId) {
      input.config = { jobId: body.jobId };
    }
    const jobId = await jobWorker.enqueue(input);
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 202);
  },
);
