import { purgeProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { RemoveEnvironmentRepository } from "~/shared/node/features/environments/remove/abstractions/RemoveEnvironmentRepository.js";
import { EnvironmentHealthCache } from "~/api/health/abstractions/EnvironmentHealthCache.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Hard delete. Everything scoped to this environment goes with it — seed entries, sync logs, job
 * history, models, tenants, stacks and files. The UI must show
 * `environmentDeletionImpactRoute` first.
 */
export const purgeProjectEnvironment = routeFactory(
  purgeProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(RemoveEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    // The environment is gone; an answer about whether it was reachable outlives it otherwise.
    container.resolve(EnvironmentHealthCache).forget(params.environmentId);

    return send.none();
  },
);
