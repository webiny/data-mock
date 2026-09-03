import { listSyncLogsRoute } from "~/shared/routes/syncLogs.js";
import { ListSyncLogsRepository } from "~/shared/node/features/syncLogs/list/abstractions/ListSyncLogsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listSyncLogs = routeFactory(listSyncLogsRoute, async ({ params, container, send }) => {
  const repository = container.resolve(ListSyncLogsRepository);
  const result = await repository.execute({ projectId: params.projectId });

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.list("syncLogs", result.value.logs, result.value.logs.length);
});
