import { Result } from "@webiny/stdlib";
import { asc, eq } from "drizzle-orm";
import { projectStacks } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListStacksRepository as Abstraction } from "./abstractions/ListStacksRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toStack, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectStack } from "~/shared/types.js";

class ListStacksRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectStack[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(projectStacks)
        .where(eq(projectStacks.environmentId, input.environmentId))
        .orderBy(asc(projectStacks.app))
        .all();

      return Result.ok(rows.map(toStack));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const ListStacksRepository = Abstraction.createImplementation({
  implementation: ListStacksRepositoryImpl,
  dependencies: [DatabaseClient],
});
