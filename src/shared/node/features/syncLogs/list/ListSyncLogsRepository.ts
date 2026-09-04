import { Result } from "@webiny/stdlib";
import { eq, desc } from "drizzle-orm";
import { syncLogs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListSyncLogsRepository as Abstraction } from "./abstractions/ListSyncLogsRepository.js";
import { SyncLogPersistenceError } from "~/shared/errors.js";
import type { SyncLog, SyncLogType, SyncLogStatus } from "~/shared/types.js";

class ListSyncLogsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(syncLogs)
        .where(eq(syncLogs.projectId, input.projectId))
        .orderBy(desc(syncLogs.createdAt))
        .all();

      const logs: SyncLog[] = rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        type: row.type as SyncLogType,
        status: row.status as SyncLogStatus,
        message: row.message,
        request: row.request ? (JSON.parse(row.request) as unknown) : null,
        response: row.response ? (JSON.parse(row.response) as unknown) : null,
        createdAt: row.createdAt,
      }));

      return Result.ok({ logs });
    } catch (error) {
      return Result.fail(new SyncLogPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListSyncLogsRepository = Abstraction.createImplementation({
  implementation: ListSyncLogsRepositoryImpl,
  dependencies: [DatabaseClient],
});
