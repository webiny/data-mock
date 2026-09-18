import { resumeSeedRoute } from "~/shared/routes/seeding.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { ResumeSeedService } from "~/shared/node/features/seeding/resume/abstractions/ResumeSeedService.js";
import { JobNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const resumeSeed = routeFactory(resumeSeedRoute, async ({ params, container, send }) => {
  const remainder = await container.resolve(ResumeSeedService).execute({
    seedJobId: params.seedJobId,
  });

  if (remainder.isFail()) {
    return send.error(remainder.error);
  }

  const jobWorker = container.resolve(JobWorker);
  const jobId = await jobWorker.enqueue({
    projectId: params.projectId,
    environmentId: params.environmentId,
    type: "seed",
    config: {
      tenant: remainder.value.tenant,
      models: remainder.value.models,
      publishStrategy: remainder.value.publishStrategy,
      publishPercent: remainder.value.publishPercent,
      includeUnpublish: remainder.value.includeUnpublish,
      batchSize: remainder.value.batchSize,
    },
  });

  const job = await jobWorker.getJob(jobId);
  if (!job) {
    return send.error(new JobNotFoundError(jobId));
  }
  return send.one("job", job, 202);
});
