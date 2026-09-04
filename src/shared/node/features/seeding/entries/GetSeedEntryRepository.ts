import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { seedEntries } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetSeedEntryRepository as Abstraction } from "./abstractions/GetSeedEntryRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedEntry } from "~/shared/types.js";

class GetSeedEntryRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedEntry, Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(seedEntries)
        .where(eq(seedEntries.id, input.id))
        .all();

      const row = rows[0];
      if (!row) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      return Result.ok({
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
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const GetSeedEntryRepository = Abstraction.createImplementation({
  implementation: GetSeedEntryRepositoryImpl,
  dependencies: [DatabaseClient],
});
