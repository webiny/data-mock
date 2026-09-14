import { updateProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { UpdateEnvironmentRepository } from "~/shared/node/features/environments/update/abstractions/UpdateEnvironmentRepository.js";
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

    return send.one("environment", result.value);
  },
);
