import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { seedJobs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetSeedJobRepository as Abstraction } from "./abstractions/GetSeedJobRepository.js";
import { JobNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedJob, SeedJobConfig, SeedJobResult, SeedJobStatus } from "~/shared/types.js";

class GetSeedJobRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedJob, Abstraction.Error>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(seedJobs)
        .where(eq(seedJobs.id, input.id))
        .get();

      if (!row) {
        return Result.fail(new JobNotFoundError(input.id));
      }

      return Result.ok({
        id: row.id,
        projectId: row.projectId,
        environmentId: row.environmentId,
        status: row.status as SeedJobStatus,
        // JSON parse boundary: the column is text, written by this codebase.
        config: JSON.parse(row.config) as SeedJobConfig,
        result: row.result === null ? null : (JSON.parse(row.result) as SeedJobResult),
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
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

export const GetSeedJobRepository = Abstraction.createImplementation({
  implementation: GetSeedJobRepositoryImpl,
  dependencies: [DatabaseClient],
});
