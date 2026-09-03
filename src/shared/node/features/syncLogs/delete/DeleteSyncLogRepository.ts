import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { syncLogs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { DeleteSyncLogRepository as Abstraction } from "./abstractions/DeleteSyncLogRepository.js";
import { SyncLogPersistenceError } from "~/shared/errors.js";

class DeleteSyncLogRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      this.databaseClient.db.delete(syncLogs).where(eq(syncLogs.id, input.id)).run();
      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new SyncLogPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const DeleteSyncLogRepository = Abstraction.createImplementation({
  implementation: DeleteSyncLogRepositoryImpl,
  dependencies: [DatabaseClient],
});
