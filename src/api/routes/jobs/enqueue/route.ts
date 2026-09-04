import { enqueueJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const enqueueJob = routeFactory(
  enqueueJobRoute,
  async ({ params, body, container, send }) => {
    const getProject = container.resolve(GetProjectRepository);
    const projectResult = await getProject.execute({ id: params.projectId });
    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    const jobWorker = container.resolve(JobWorker);
    const input: JobWorker.CreateJobInput = {
      projectId: params.projectId,
      type: body.type,
    };
    if (body.config) {
      input.config = body.config;
    }
    const jobId = await jobWorker.enqueue(input);
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 201);
  },
);
