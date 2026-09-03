import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectGroups } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectGroupsRepository as Abstraction } from "./abstractions/ListProjectGroupsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectGroup } from "~/shared/types.js";

class ListProjectGroupsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectGroup[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(projectGroups)
        .where(eq(projectGroups.projectId, input.projectId))
        .all();

      return Result.ok(rows);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListProjectGroupsRepository = Abstraction.createImplementation({
  implementation: ListProjectGroupsRepositoryImpl,
  dependencies: [DatabaseClient],
});
