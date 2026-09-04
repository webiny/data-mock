import { Result } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";
import { listSyncLogsRoute, deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SyncLogsGateway as Abstraction } from "./abstractions/SyncLogsGateway.js";

class SyncLogsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(projectId: string): Promise<Result<SyncLog[], HTTPError>> {
    const result = await this.httpClient.request(listSyncLogsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.syncLogs.items);
  }

  public async remove(projectId: string, logId: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(deleteSyncLogRoute, {
      params: { projectId, logId },
    });
  }
}

export const SyncLogsGateway = Abstraction.createImplementation({
  implementation: SyncLogsGatewayImpl,
  dependencies: [HTTPClient],
});
