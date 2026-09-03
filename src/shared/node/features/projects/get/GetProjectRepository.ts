import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { GetProjectRepository as Abstraction } from "./abstractions/GetProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import type { Project } from "~/shared/types.js";

class GetProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!row) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      return Result.ok(row);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const GetProjectRepository = Abstraction.createImplementation({
  implementation: GetProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
