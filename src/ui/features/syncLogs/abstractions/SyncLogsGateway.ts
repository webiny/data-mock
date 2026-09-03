import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ISyncLogsGateway {
  list(projectId: string): Promise<Result<SyncLog[], HTTPError>>;
}

export const SyncLogsGateway = createAbstraction<ISyncLogsGateway>("Ui/SyncLogsGateway");

export namespace SyncLogsGateway {
  export type Interface = ISyncLogsGateway;
}
