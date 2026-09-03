import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { seedEntries } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { DeleteProjectEntriesRepository as Abstraction } from "./abstractions/DeleteProjectEntriesRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

class DeleteProjectEntriesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      this.databaseClient.db
        .delete(seedEntries)
        .where(eq(seedEntries.projectId, input.projectId))
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

export const DeleteProjectEntriesRepository = Abstraction.createImplementation({
  implementation: DeleteProjectEntriesRepositoryImpl,
  dependencies: [DatabaseClient],
});
