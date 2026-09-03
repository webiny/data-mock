import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SyncLogPersistenceError } from "~/shared/errors.js";

export interface IDeleteSyncLogRepositoryInput {
  id: string;
}

export interface IDeleteSyncLogRepository {
  execute(
    input: DeleteSyncLogRepository.Input,
  ): Promise<Result<void, DeleteSyncLogRepository.Error>>;
}

export const DeleteSyncLogRepository = createAbstraction<IDeleteSyncLogRepository>(
  "SyncLogs/DeleteSyncLogRepository",
);

export namespace DeleteSyncLogRepository {
  export type Interface = IDeleteSyncLogRepository;
  export type Input = IDeleteSyncLogRepositoryInput;
  export type Error = SyncLogPersistenceError;
}
