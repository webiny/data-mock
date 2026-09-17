import { updateProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { UpdateEnvironmentRepository } from "~/shared/node/features/environments/update/abstractions/UpdateEnvironmentRepository.js";
import { EnvironmentHealthCache } from "~/api/health/abstractions/EnvironmentHealthCache.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const updateProjectEnvironment = routeFactory(
  updateProjectEnvironmentRoute,
  async ({ params, body, container, send }) => {
    const repository = container.resolve(UpdateEnvironmentRepository);

    const input: UpdateEnvironmentRepository.Input = { id: params.environmentId };
    if (body.region !== undefined) {
      input.region = body.region;
    }
    if (body.apiUrl !== undefined) {
      input.apiUrl = body.apiUrl;
    }
    if (body.apiToken !== undefined) {
      input.apiToken = body.apiToken;
    }
    if (body.tenant !== undefined) {
      input.tenant = body.tenant;
    }

    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    // The url, the token and the tenant are exactly what health asked with. A cached verdict from
    // before this change answers for the old ones.
    container.resolve(EnvironmentHealthCache).forget(params.environmentId);

    return send.one("environment", result.value);
  },
);
