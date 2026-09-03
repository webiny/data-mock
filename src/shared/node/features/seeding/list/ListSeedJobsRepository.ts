import { Result } from "@webiny/stdlib";
import { eq, desc } from "drizzle-orm";
import { seedJobs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListSeedJobsRepository as Abstraction } from "./abstractions/ListSeedJobsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedJob, SeedJobConfig, SeedJobResult, SeedJobStatus } from "~/shared/types.js";

class ListSeedJobsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedJob[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(seedJobs)
        .where(eq(seedJobs.projectId, input.projectId))
        .orderBy(desc(seedJobs.createdAt))
        .all();

      return Result.ok(
        rows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          status: row.status as SeedJobStatus,
          config: JSON.parse(row.config) as SeedJobConfig,
          result: row.result ? (JSON.parse(row.result) as SeedJobResult) : null,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          createdAt: row.createdAt,
        })),
      );
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListSeedJobsRepository = Abstraction.createImplementation({
  implementation: ListSeedJobsRepositoryImpl,
  dependencies: [DatabaseClient],
});
