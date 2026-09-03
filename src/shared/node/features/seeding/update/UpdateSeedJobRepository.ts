import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { seedJobs } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { UpdateSeedJobRepository as Abstraction } from "./abstractions/UpdateSeedJobRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

class UpdateSeedJobRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      this.databaseClient.db
        .update(seedJobs)
        .set({
          status: input.status,
          result: input.result ? JSON.stringify(input.result) : undefined,
          finishedAt:
            input.status === "completed" || input.status === "failed" ? Date.now() : undefined,
        })
        .where(eq(seedJobs.id, input.id))
        .run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const UpdateSeedJobRepository = Abstraction.createImplementation({
  implementation: UpdateSeedJobRepositoryImpl,
  dependencies: [DatabaseClient],
});
