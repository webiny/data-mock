import { Result } from "@webiny/stdlib";
import { and, count, eq } from "drizzle-orm";
import { seedEntries } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetSeedJobRepository } from "./abstractions/GetSeedJobRepository.js";
import { ResumeSeedService as Abstraction } from "./abstractions/ResumeSeedService.js";
import { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";
import type { SeedModelConfig } from "~/shared/types.js";

const DEFAULT_BATCH_SIZE = 1;

/** A run that finished on purpose has nothing left to do. */
const RESUMABLE_STATUSES = new Set(["cancelled", "failed"]);

/**
 * Works out what is left of a seed run that stopped early.
 *
 * It reads what the run was asked for off its own `seed_jobs` row and counts what actually landed
 * in `seed_entries`, then asks for the difference. Nothing is replayed: the remainder is seeded as
 * a fresh run, because the entries already created are real and re-sending them would duplicate
 * them — which is the whole reason a cancelled run could not simply be started again.
 */
class ResumeSeedServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getSeedJobRepository: GetSeedJobRepository.Interface,
    private readonly databaseClient: DatabaseClient.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const jobResult = await this.getSeedJobRepository.execute({ id: input.seedJobId });
    if (jobResult.isFail()) {
      return Result.fail(jobResult.error);
    }

    const job = jobResult.value;
    if (!RESUMABLE_STATUSES.has(job.status)) {
      return Result.fail(new ValidationError(`A ${job.status} seed run has nothing to resume.`));
    }

    let created: Map<string, number>;
    try {
      created = this.countCreatedByModel(job.id);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }

    const remaining: SeedModelConfig[] = [];
    for (const model of job.config.models) {
      const done = created.get(model.modelId) ?? 0;
      if (done >= model.amount) {
        continue;
      }
      remaining.push({ ...model, amount: model.amount - done });
    }

    if (remaining.length === 0) {
      return Result.fail(new ValidationError("This run created everything it was asked for."));
    }

    const tenant = job.config.tenant ?? this.tenantOfEntries(job.id);
    if (tenant === null) {
      /**
       * Rows written before the tenant was stored, whose run created nothing, leave no way to
       * know where the entries were meant to go. Guessing would seed the wrong tenant.
       */
      return Result.fail(
        new ValidationError("This run does not record which tenant it was seeding."),
      );
    }

    const alreadyCreated = [...created.values()].reduce((total, amount) => total + amount, 0);

    return Result.ok({
      environmentId: job.environmentId,
      tenant,
      models: remaining,
      batchSize: job.config.batchSize ?? DEFAULT_BATCH_SIZE,
      publishStrategy: job.config.publishStrategy,
      publishPercent: job.config.publishPercent,
      includeUnpublish: job.config.includeUnpublish,
      alreadyCreated,
    });
  }

  /** Counted in SQL rather than listed: a run of ten thousand entries should not be read back. */
  private countCreatedByModel(seedJobId: string): Map<string, number> {
    const rows = this.databaseClient.db
      .select({ modelId: seedEntries.modelId, total: count() })
      .from(seedEntries)
      .where(and(eq(seedEntries.jobId, seedJobId), eq(seedEntries.status, "created")))
      .groupBy(seedEntries.modelId)
      .all();

    return new Map(rows.map((row) => [row.modelId, row.total]));
  }

  private tenantOfEntries(seedJobId: string): string | null {
    const row = this.databaseClient.db
      .select({ tenant: seedEntries.tenant })
      .from(seedEntries)
      .where(eq(seedEntries.jobId, seedJobId))
      .get();

    return row?.tenant ?? null;
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ResumeSeedService = Abstraction.createImplementation({
  implementation: ResumeSeedServiceImpl,
  dependencies: [GetSeedJobRepository, DatabaseClient],
});
