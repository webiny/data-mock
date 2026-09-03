import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { RemoveProjectRepository as Abstraction } from "./abstractions/RemoveProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

class RemoveProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      const existing = this.databaseClient.db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      this.databaseClient.db.delete(projects).where(eq(projects.id, input.id)).run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const RemoveProjectRepository = Abstraction.createImplementation({
  implementation: RemoveProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
