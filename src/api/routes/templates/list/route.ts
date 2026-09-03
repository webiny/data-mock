import { listSeedTemplatesRoute } from "~/shared/routes/templates.js";
import { ListSeedTemplatesRepository } from "~/shared/node/features/templates/list/abstractions/ListSeedTemplatesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listSeedTemplates = routeFactory(
  listSeedTemplatesRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListSeedTemplatesRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("templates", result.value, result.value.length);
  },
);
