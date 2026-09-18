import { Result } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";
import { deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SyncLogsGateway as Abstraction } from "./abstractions/SyncLogsGateway.js";
import type { SyncLogsListParams, SyncLogsListResult } from "./abstractions/SyncLogsGateway.js";
import type { EnvironmentRef } from "~/shared/types.js";

interface SyncLogsListResponse {
  syncLogs: { items: SyncLog[]; total: number };
}

class SyncLogsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    ref: EnvironmentRef,
    params?: SyncLogsListParams,
  ): Promise<Result<SyncLogsListResult, HTTPError>> {
    const parts: string[] = [];
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;
    parts.push(`page=${page}`, `limit=${limit}`);
    if (params?.type) {
      parts.push(`type=${params.type}`);
    }
    if (params?.status) {
      parts.push(`status=${params.status}`);
    }
    const qs = parts.join("&");

    const result = await this.httpClient.get<SyncLogsListResponse>(
      `/api/projects/${ref.projectId}/environments/${ref.environmentId}/sync-logs?${qs}`,
    );

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
