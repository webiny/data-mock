import { deployEnvironmentRoute } from "~/shared/routes/environments.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { GetProjectUseCase } from "~/shared/node/features/projects/get/abstractions/GetProjectUseCase.js";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { EnvironmentNotFoundError, JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Both ids are resolved before anything is queued. `jobs` has a foreign key to each, so enqueueing
 * against an id that does not exist surfaced as a 500 rather than saying what was wrong — and a job
 * for an environment belonging to another project would sit in the queue until the run refused it.
 */
export const deployEnvironment = routeFactory(
  deployEnvironmentRoute,
  async ({ params, body, container, send }) => {
    const projectResult = await container
      .resolve(GetProjectUseCase)
      .execute({ id: params.projectId });

    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    const environmentResult = await container
      .resolve(GetEnvironmentRepository)
      .execute({ id: params.environmentId });

    if (environmentResult.isFail()) {
      return send.error(environmentResult.error);
    }

    if (environmentResult.value.projectId !== params.projectId) {
      return send.error(new EnvironmentNotFoundError(params.environmentId));
    }

    const jobWorker = container.resolve(JobWorker);

    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      environmentId: params.environmentId,
      type: "deploy",
      config: {
        environmentId: params.environmentId,
        ...(body.apps ? { apps: body.apps } : {}),
        ...(body.region ? { region: body.region } : {}),
        ...(body.preview === true ? { preview: true } : {}),
      },
    });

    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }

    return send.one("job", job, 202);
  },
);
