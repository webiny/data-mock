import { restoreProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { ArchiveEnvironmentRepository } from "~/shared/node/features/environments/archive/abstractions/ArchiveEnvironmentRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const restoreProjectEnvironment = routeFactory(
  restoreProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ArchiveEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId, archived: false });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("environment", result.value);
  },
);
