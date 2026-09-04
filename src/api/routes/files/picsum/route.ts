import { pullPicsumImagesRoute } from "~/shared/routes/files.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const pullPicsumImages = routeFactory(
  pullPicsumImagesRoute,
  async ({ body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);
    const jobId = await jobWorker.enqueue({
      projectId: null,
      type: "pull-picsum",
      config: { count: body.count, width: body.width, height: body.height },
    });
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("result", job, 202);
  },
);
