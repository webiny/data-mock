import { createProjectEnvironmentRoute } from "~/shared/routes/environments.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const createProjectEnvironment = routeFactory(
  createProjectEnvironmentRoute,
  async ({ params, body, container, send }) => {
    const repository = container.resolve(CreateEnvironmentRepository);

    const input: CreateEnvironmentRepository.Input = {
      projectId: params.projectId,
      env: body.env,
      variant: body.variant,
      tenant: body.tenant,
    };
    if (body.region !== undefined) {
      input.region = body.region;
    }
    if (body.apiUrl !== undefined) {
      input.apiUrl = body.apiUrl;
    }
    if (body.apiToken !== undefined) {
      input.apiToken = body.apiToken;
    }

    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("environment", result.value, 201);
  },
);
