import { enqueueJobRoute } from "~/shared/routes/jobs.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { getJobTypeDescriptor } from "~/shared/jobs/descriptors.js";
import { JobNotFoundError, ValidationError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import type { JobType } from "~/shared/jobs/descriptors.js";

export const enqueueJob = routeFactory(
  enqueueJobRoute,
  async ({ params, body, container, send }) => {
    const getProject = container.resolve(GetProjectRepository);
    const projectResult = await getProject.execute({ id: params.projectId });
    if (projectResult.isFail()) {
      return send.error(projectResult.error);
    }

    /**
     * The route body types `config` as a bare record, so the only thing standing between this
     * endpoint and an arbitrary job config is the per-type schema on the descriptor. Validate
     * against it here — an environment-scoped job with no environmentId would otherwise fail deep
     * inside its executor, long after the 201 was returned.
     */
    const descriptor = getJobTypeDescriptor(body.type);
    if (!descriptor) {
      return send.error(new ValidationError(`Unknown job type "${body.type}"`));
    }

    const parsedConfig = descriptor.configSchema.safeParse(body.config ?? {});
    if (!parsedConfig.success) {
      const issue = parsedConfig.error.issues[0];
      return send.error(
        new ValidationError(
          `Invalid config for job type "${body.type}": ${issue?.message ?? "validation failed"}`,
        ),
      );
    }

    const config = parsedConfig.data as Record<string, unknown>;
    const environmentId =
      typeof config["environmentId"] === "string" ? config["environmentId"] : null;

    const jobWorker = container.resolve(JobWorker);
    const input: JobWorker.CreateJobInput = {
      projectId: params.projectId,
      type: body.type as JobType,
      config,
    };
    if (environmentId !== null) {
      input.environmentId = environmentId;
    }

    const jobId = await jobWorker.enqueue(input);
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 201);
  },
);
