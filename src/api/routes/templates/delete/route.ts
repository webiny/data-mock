import { deleteSeedTemplateRoute } from "~/shared/routes/templates.js";
import { DeleteSeedTemplateRepository } from "~/shared/node/features/templates/delete/abstractions/DeleteSeedTemplateRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deleteSeedTemplate = routeFactory(
  deleteSeedTemplateRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(DeleteSeedTemplateRepository);
    const result = await repository.execute({ id: params.templateId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
