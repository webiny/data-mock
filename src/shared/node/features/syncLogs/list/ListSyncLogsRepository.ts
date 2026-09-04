import { Result } from "@webiny/stdlib";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { syncLogs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListSyncLogsRepository as Abstraction } from "./abstractions/ListSyncLogsRepository.js";
import { SyncLogPersistenceError } from "~/shared/errors.js";
import type { SyncLog, SyncLogType, SyncLogStatus } from "~/shared/types.js";

const SYNC_LOG_SORT_COLUMNS = {
  createdAt: syncLogs.createdAt,
  type: syncLogs.type,
  status: syncLogs.status,
} as const;

type SyncLogSortField = keyof typeof SYNC_LOG_SORT_COLUMNS;

function isSyncLogSortField(value: string | undefined): value is SyncLogSortField {
  return value !== undefined && Object.hasOwn(SYNC_LOG_SORT_COLUMNS, value);
}

class ListSyncLogsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      const conditions: SQL[] = [eq(syncLogs.projectId, input.projectId)];
      if (input.type) {
        conditions.push(eq(syncLogs.type, input.type));
      }
      if (input.status) {
        conditions.push(eq(syncLogs.status, input.status));
      }
      const whereClause = and(...conditions)!;

      const totalResult = this.databaseClient.db
        .select({ total: count() })
        .from(syncLogs)
        .where(whereClause)
        .all();
      const total = totalResult[0]?.total ?? 0;

      const sortColumn = isSyncLogSortField(input.sortField)
        ? SYNC_LOG_SORT_COLUMNS[input.sortField]
        : syncLogs.createdAt;
      const orderBy = input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      const rows = this.databaseClient.db
        .select()
        .from(syncLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
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

      return Result.ok({ logs, total });
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
