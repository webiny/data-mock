import { listSyncLogsRoute } from "~/shared/routes/syncLogs.js";
import { ListSyncLogsRepository } from "~/shared/node/features/syncLogs/list/abstractions/ListSyncLogsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { parseListQuery, getStringFilter } from "~/api/routing/parseListQuery.js";
import type { SyncLogType, SyncLogStatus } from "~/shared/types.js";

function isSyncLogType(value: string | undefined): value is SyncLogType {
  return (
    value === "tenants" || value === "models" || value === "upload-file" || value === "pull-files"
  );
}

function isSyncLogStatus(value: string | undefined): value is SyncLogStatus {
  return value === "success" || value === "error";
}

export const listSyncLogs = routeFactory(
  listSyncLogsRoute,
  async ({ params, query, container, send }) => {
    const { limit, offset, sortField, sortDir } = parseListQuery(query);

    const input: ListSyncLogsRepository.Input = {
      projectId: params.projectId,
      limit,
      offset,
      sortDir,
    };
    if (sortField) {
      input.sortField = sortField;
    }
    const type = getStringFilter(query, "type");
    if (isSyncLogType(type)) {
      input.type = type;
    }
    const status = getStringFilter(query, "status");
    if (isSyncLogStatus(status)) {
      input.status = status;
    }

    const repository = container.resolve(ListSyncLogsRepository);
    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("syncLogs", result.value.logs, result.value.total);
  },
);
