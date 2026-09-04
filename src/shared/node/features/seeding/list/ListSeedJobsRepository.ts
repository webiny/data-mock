import { Result } from "@webiny/stdlib";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { seedJobs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListSeedJobsRepository as Abstraction } from "./abstractions/ListSeedJobsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedJob, SeedJobConfig, SeedJobResult, SeedJobStatus } from "~/shared/types.js";

const SEED_JOB_SORT_COLUMNS = {
  createdAt: seedJobs.createdAt,
  status: seedJobs.status,
} as const;

type SeedJobSortField = keyof typeof SEED_JOB_SORT_COLUMNS;

function isSeedJobSortField(value: string | undefined): value is SeedJobSortField {
  return value !== undefined && Object.hasOwn(SEED_JOB_SORT_COLUMNS, value);
}

class ListSeedJobsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      const conditions: SQL[] = [eq(seedJobs.projectId, input.projectId)];
      if (input.status) {
        conditions.push(eq(seedJobs.status, input.status));
      }
      const whereClause = and(...conditions)!;

      const totalResult = this.databaseClient.db
        .select({ total: count() })
        .from(seedJobs)
        .where(whereClause)
        .all();
      const total = totalResult[0]?.total ?? 0;

      const sortColumn = isSeedJobSortField(input.sortField)
        ? SEED_JOB_SORT_COLUMNS[input.sortField]
        : seedJobs.createdAt;
      const orderBy = input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      const rows = this.databaseClient.db
        .select()
        .from(seedJobs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .all();

      const seedJobsList: SeedJob[] = rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        status: row.status as SeedJobStatus,
        config: JSON.parse(row.config) as SeedJobConfig,
        result: row.result ? (JSON.parse(row.result) as SeedJobResult) : null,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        createdAt: row.createdAt,
      }));

      return Result.ok({ seedJobs: seedJobsList, total });
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
