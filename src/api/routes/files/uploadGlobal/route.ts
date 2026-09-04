import { uploadGlobalFilesRoute } from "~/shared/routes/files.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const uploadGlobalFiles = routeFactory(
  uploadGlobalFilesRoute,
  async ({ params, body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);
    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      type: "upload-files",
      config: {
        tenant: body.tenant,
        fileNames: body.fileNames,
      },
    });
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 202);
  },
);
