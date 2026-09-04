import { Result } from "@webiny/stdlib";
import { eq, and, desc, count } from "drizzle-orm";
import { seedEntries } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListSeedEntriesRepository as Abstraction } from "./abstractions/ListSeedEntriesRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedEntry } from "~/shared/types.js";
import type { SQL } from "drizzle-orm";

class ListSeedEntriesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      const conditions: SQL[] = [eq(seedEntries.projectId, input.projectId)];

      if (input.modelId) {
        conditions.push(eq(seedEntries.modelId, input.modelId));
      }
      if (input.tenant) {
        conditions.push(eq(seedEntries.tenant, input.tenant));
      }
      if (input.jobId) {
        conditions.push(eq(seedEntries.jobId, input.jobId));
      }
      if (input.status) {
        conditions.push(eq(seedEntries.status, input.status));
      }

      const whereClause = and(...conditions)!;

      const totalResult = this.databaseClient.db
        .select({ total: count() })
        .from(seedEntries)
        .where(whereClause)
        .all();

      const total = totalResult[0]?.total ?? 0;

      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      const rows = this.databaseClient.db
        .select()
        .from(seedEntries)
        .where(whereClause)
        .orderBy(desc(seedEntries.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      const entries: SeedEntry[] = rows.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        projectId: row.projectId,
        tenant: row.tenant,
        modelId: row.modelId,
        entryId: row.entryId,
        entryData: JSON.parse(row.entryData) as Record<string, unknown>,
        requestData: row.requestData
          ? (JSON.parse(row.requestData) as Record<string, unknown>)
          : null,
        responseData: row.responseData,
        httpStatus: row.httpStatus,
        status: row.status as SeedEntry["status"],
        error: row.error,
        createdAt: row.createdAt,
      }));

      return Result.ok({ entries, total });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListSeedEntriesRepository = Abstraction.createImplementation({
  implementation: ListSeedEntriesRepositoryImpl,
  dependencies: [DatabaseClient],
});
