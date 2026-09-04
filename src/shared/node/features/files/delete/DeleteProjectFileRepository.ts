import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectFiles } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { DeleteProjectFileRepository as Abstraction } from "./abstractions/DeleteProjectFileRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

class DeleteProjectFileRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      const result = this.databaseClient.db
        .delete(projectFiles)
        .where(eq(projectFiles.id, input.id))
        .run();

      if (result.changes === 0) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const DeleteProjectFileRepository = Abstraction.createImplementation({
  implementation: DeleteProjectFileRepositoryImpl,
  dependencies: [DatabaseClient],
});
