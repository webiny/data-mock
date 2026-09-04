import { listProjectModelsRoute } from "~/shared/routes/models.js";
import { ListProjectModelsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectModelsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjectModels = routeFactory(
  listProjectModelsRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListProjectModelsRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("models", result.value, result.value.length);
  },
);
