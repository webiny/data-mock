import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLog, SyncLogType, SyncLogStatus } from "~/shared/types.js";
import type { SyncLogPersistenceError } from "~/shared/errors.js";

export interface IListSyncLogsRepositoryInput {
  projectId: string;
  type?: SyncLogType;
  status?: SyncLogStatus;
  limit?: number;
  offset?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export interface IListSyncLogsRepositoryOutput {
  logs: SyncLog[];
  total: number;
}

export interface IListSyncLogsRepository {
  execute(
    input: ListSyncLogsRepository.Input,
  ): Promise<Result<ListSyncLogsRepository.Output, ListSyncLogsRepository.Error>>;
}

export const ListSyncLogsRepository = createAbstraction<IListSyncLogsRepository>(
  "SyncLogs/ListSyncLogsRepository",
);

export namespace ListSyncLogsRepository {
  export type Interface = IListSyncLogsRepository;
  export type Input = IListSyncLogsRepositoryInput;
  export type Output = IListSyncLogsRepositoryOutput;
  export type Error = SyncLogPersistenceError;
}
