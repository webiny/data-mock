import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface SyncLogsListParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

export interface SyncLogsListResult {
  logs: SyncLog[];
  total: number;
}

export interface ISyncLogsGateway {
  list(
    projectId: string,
    params?: SyncLogsListParams,
  ): Promise<Result<SyncLogsListResult, HTTPError>>;
  remove(projectId: string, logId: string): Promise<Result<void, HTTPError>>;
}

export const SyncLogsGateway = createAbstraction<ISyncLogsGateway>("Ui/SyncLogsGateway");

export namespace SyncLogsGateway {
  export type Interface = ISyncLogsGateway;
}
