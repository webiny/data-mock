import { createSeedTemplateRoute } from "~/shared/routes/templates.js";
import { CreateSeedTemplateRepository } from "~/shared/node/features/templates/create/abstractions/CreateSeedTemplateRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const createSeedTemplate = routeFactory(
  createSeedTemplateRoute,
  async ({ params, body, container, send }) => {
    const repository = container.resolve(CreateSeedTemplateRepository);
    const result = await repository.execute({
      projectId: params.projectId,
      name: body.name,
      config: body.config,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("template", result.value, 201);
  },
);
