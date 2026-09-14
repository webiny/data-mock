import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { RemoveEnvironmentRepository as Abstraction } from "./abstractions/RemoveEnvironmentRepository.js";
import { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironmentError } from "../toEnvironment.js";

class RemoveEnvironmentRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<void, Abstraction.Error>> {
    try {
      const existing = this.databaseClient.db
        .select()
        .from(projectEnvironments)
        .where(eq(projectEnvironments.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new EnvironmentNotFoundError(input.id));
      }

      this.databaseClient.db
        .delete(projectEnvironments)
        .where(eq(projectEnvironments.id, input.id))
        .run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const RemoveEnvironmentRepository = Abstraction.createImplementation({
  implementation: RemoveEnvironmentRepositoryImpl,
  dependencies: [DatabaseClient],
});
