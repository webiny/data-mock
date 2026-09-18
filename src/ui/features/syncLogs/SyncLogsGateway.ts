import { Result } from "@webiny/stdlib";
import { listSyncLogsRoute, deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SyncLogsGateway as Abstraction } from "./abstractions/SyncLogsGateway.js";
import type { SyncLogsListParams, SyncLogsListResult } from "./abstractions/SyncLogsGateway.js";
import type { EnvironmentRef } from "~/shared/types.js";

class SyncLogsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    ref: EnvironmentRef,
    params?: SyncLogsListParams,
  ): Promise<Result<SyncLogsListResult, HTTPError>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;

    const result = await this.httpClient.request(listSyncLogsRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
      query: {
        page: String(page),
        limit: String(limit),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({
      logs: result.value.syncLogs.items,
      total: result.value.syncLogs.total,
    });
  }

  public async remove(ref: EnvironmentRef, logId: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(deleteSyncLogRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId, logId },
    });
  }
}

export const SyncLogsGateway = Abstraction.createImplementation({
  implementation: SyncLogsGatewayImpl,
  dependencies: [HTTPClient],
});
