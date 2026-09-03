import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLog } from "~/shared/types.js";
import type { SyncLogPersistenceError } from "~/shared/errors.js";

export interface IListSyncLogsRepositoryInput {
  projectId: string;
}

export interface IListSyncLogsRepositoryOutput {
  logs: SyncLog[];
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
