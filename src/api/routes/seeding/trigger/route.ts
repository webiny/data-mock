import { triggerSeedRoute } from "~/shared/routes/seeding.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const triggerSeed = routeFactory(
  triggerSeedRoute,
  async ({ params, body, container, send }) => {
    const jobWorker = container.resolve(JobWorker);
    const jobId = await jobWorker.enqueue({
      projectId: params.projectId,
      type: "seed",
      config: {
        tenant: body.tenant,
        models: body.models,
        publishStrategy: body.publishStrategy,
        publishPercent: body.publishPercent,
        includeUnpublish: body.includeUnpublish,
        dryRun: body.dryRun,
        batchSize: body.batchSize,
      },
    });
    const job = await jobWorker.getJob(jobId);
    if (!job) {
      return send.error(new JobNotFoundError(jobId));
    }
    return send.one("job", job, 202);
  },
);
