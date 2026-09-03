import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLog, SyncLogType, SyncLogStatus } from "~/shared/types.js";
import type { SyncLogPersistenceError } from "~/shared/errors.js";

export interface ICreateSyncLogRepositoryInput {
  projectId: string;
  type: SyncLogType;
  status: SyncLogStatus;
  message: string;
  request?: unknown;
  response?: unknown;
}

export interface ICreateSyncLogRepository {
  execute(
    input: CreateSyncLogRepository.Input,
  ): Promise<Result<SyncLog, CreateSyncLogRepository.Error>>;
}

export const CreateSyncLogRepository = createAbstraction<ICreateSyncLogRepository>(
  "SyncLogs/CreateSyncLogRepository",
);

export namespace CreateSyncLogRepository {
  export type Interface = ICreateSyncLogRepository;
  export type Input = ICreateSyncLogRepositoryInput;
  export type Error = SyncLogPersistenceError;
}
