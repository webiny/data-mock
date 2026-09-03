import { syncProjectModelsRoute } from "~/shared/routes/models.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const syncProjectModels = routeFactory(
  syncProjectModelsRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(SyncModelsService);
    const syncLogRepository = container.resolve(CreateSyncLogRepository);
    const result = await service.execute({ projectId: params.projectId });

    if (result.isFail()) {
      await syncLogRepository.execute({
        projectId: params.projectId,
        type: "models",
        status: "error",
        message: result.error.message,
        response: result.error.data,
      });
      return send.error(result.error);
    }

    await syncLogRepository.execute({
      projectId: params.projectId,
      type: "models",
      status: "success",
      message: `Synced ${result.value.models} model(s)`,
      response: result.value,
    });

    return send.one("sync", result.value);
  },
);
