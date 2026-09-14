import { removeProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { RemoveEnvironmentRepository } from "~/shared/node/features/environments/remove/abstractions/RemoveEnvironmentRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const removeProjectEnvironment = routeFactory(
  removeProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(RemoveEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
