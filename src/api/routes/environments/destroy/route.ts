import { destroyEnvironmentRoute } from "~/shared/routes/environments.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { GetProjectUseCase } from "~/shared/node/features/projects/get/abstractions/GetProjectUseCase.js";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { EnvironmentNotFoundError, JobNotFoundError, ValidationError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * The typed-name check runs here, not only in the browser. A confirmation that exists only in the
 * UI is not a confirmation — this endpoint tears down real infrastructure, and anything that can
 * reach it can skip the dialog.
 */
export const destroyEnvironment = routeFactory(
  destroyEnvironmentRoute,
  async ({ params, body, container, send }) => {
    const projectResult = await container
      .resolve(GetProjectUseCase)
      .execute({ id: params.projectId });

    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    const project = projectResult.value;

    if (body.confirmProjectName.trim() !== project.name) {
      return send.error(
        new ValidationError(
          `Destroy not confirmed: "confirmProjectName" must be exactly "${project.name}".`,
        ),
      );
    }

    const environmentResult = await container
      .resolve(GetEnvironmentRepository)
      .execute({ id: params.environmentId });

    if (environmentResult.isFail()) {
      return send.error(environmentResult.error);
    }

    // Belonging to the project in the path is what makes the name check above mean anything.
    if (environmentResult.value.projectId !== params.projectId) {
      return send.error(new EnvironmentNotFoundError(params.environmentId));
    }

    const jobWorker = container.resolve(JobWorker);

    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      environmentId: params.environmentId,
      type: "destroy",
      config: {
        environmentId: params.environmentId,
        ...(body.apps ? { apps: body.apps } : {}),
        ...(body.region ? { region: body.region } : {}),
      },
    });

    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }

    return send.one("job", job, 202);
  },
);
