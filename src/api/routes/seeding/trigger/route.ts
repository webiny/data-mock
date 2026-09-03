import { triggerSeedRoute } from "~/shared/routes/seeding.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const triggerSeed = routeFactory(
  triggerSeedRoute,
  async ({ params, body, container, send }) => {
    const seedService = container.resolve(SeedService);
    const result = await seedService.execute({
      projectId: params.projectId,
      tenant: body.tenant,
      models: body.models,
      dryRun: body.dryRun,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one(
      "seedJob",
      {
        id: result.value.jobId,
        projectId: params.projectId,
        status: result.value.errors.length === 0 ? "completed" : "completed",
        config: { models: body.models },
        result: {
          created: result.value.created,
          errors: result.value.errors.map((e) => ({ message: e.message, code: "SEED_ERROR" })),
        },
        startedAt: Date.now(),
        finishedAt: Date.now(),
        createdAt: Date.now(),
      },
      201,
    );
  },
);
