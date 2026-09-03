import { Result } from "@webiny/stdlib";
import { generateId } from "@webiny/stdlib";
import { seedJobs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateSeedJobRepository as Abstraction } from "./abstractions/CreateSeedJobRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedJob } from "~/shared/types.js";

class CreateSeedJobRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedJob, Abstraction.Error>> {
    try {
      const now = Date.now();
      const id = generateId();

      this.databaseClient.db
        .insert(seedJobs)
        .values({
          id,
          projectId: input.projectId,
          status: "running",
          config: JSON.stringify(input.config),
          startedAt: now,
          createdAt: now,
        })
        .run();

      return Result.ok({
        id,
        projectId: input.projectId,
        status: "running" as const,
        config: input.config,
        result: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const CreateSeedJobRepository = Abstraction.createImplementation({
  implementation: CreateSeedJobRepositoryImpl,
  dependencies: [DatabaseClient],
});
