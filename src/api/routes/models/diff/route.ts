import { diffProjectModelsRoute } from "~/shared/routes/models.js";
import { CompareModelsService } from "~/shared/node/features/models/sync/abstractions/CompareModelsService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const diffProjectModels = routeFactory(
  diffProjectModelsRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(CompareModelsService);
    const result = await service.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("diff", result.value.items, result.value.items.length);
  },
);
