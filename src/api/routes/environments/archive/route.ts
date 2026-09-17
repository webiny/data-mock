import { archiveProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { EnvironmentHealthCache } from "~/api/health/abstractions/EnvironmentHealthCache.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const archiveProjectEnvironment = routeFactory(
  archiveProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ArchiveEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId, archived: true });

    if (result.isFail()) {
      return send.error(result.error);
    }

    container.resolve(EnvironmentHealthCache).forget(params.environmentId);

    return send.one("environment", result.value);
  },
);
