import { getProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getProjectEnvironment = routeFactory(
  getProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(GetEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("environment", result.value);
  },
);
