import { syncProjectModelsRoute } from "~/shared/routes/models.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const syncProjectModels = routeFactory(
  syncProjectModelsRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(SyncModelsService);
    const result = await service.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("sync", result.value);
  },
);
