import { getProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { EnvironmentNotFoundError } from "~/shared/errors.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getProjectEnvironment = routeFactory(
  getProjectEnvironmentRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(GetEnvironmentRepository);
    const result = await repository.execute({ id: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    // The path says which project it belongs to; reading another project's environment through it
    // would make that half of the path decoration.
    if (result.value.projectId !== params.projectId) {
      return send.error(new EnvironmentNotFoundError(params.environmentId));
    }

    return send.one("environment", result.value);
  },
);
