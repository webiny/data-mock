import { deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { DeleteSyncLogRepository } from "~/shared/node/features/syncLogs/delete/abstractions/DeleteSyncLogRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deleteSyncLog = routeFactory(
  deleteSyncLogRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(DeleteSyncLogRepository);
    const result = await repository.execute({ id: params.logId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
