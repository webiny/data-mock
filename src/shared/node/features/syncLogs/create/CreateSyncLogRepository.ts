import { Result, generateId } from "@webiny/stdlib";
import { syncLogs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateSyncLogRepository as Abstraction } from "./abstractions/CreateSyncLogRepository.js";
import { SyncLogPersistenceError } from "~/shared/errors.js";
import type { SyncLog } from "~/shared/types.js";

class CreateSyncLogRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SyncLog, Abstraction.Error>> {
    try {
      const now = Date.now();
      const id = generateId();
      const response = input.response === undefined ? null : JSON.stringify(input.response);

      const row = {
        id,
        projectId: input.projectId,
        type: input.type,
        status: input.status,
        message: input.message,
        response,
        createdAt: now,
      };

      this.databaseClient.db.insert(syncLogs).values(row).run();

      return Result.ok({ ...row, response: input.response ?? null });
    } catch (error) {
      return Result.fail(new SyncLogPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const CreateSyncLogRepository = Abstraction.createImplementation({
  implementation: CreateSyncLogRepositoryImpl,
  dependencies: [DatabaseClient],
});
