import { deployEnvironmentRoute } from "~/shared/routes/environments.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deployEnvironment = routeFactory(
  deployEnvironmentRoute,
  async ({ params, body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);

    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      environmentId: params.environmentId,
      type: "deploy",
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
