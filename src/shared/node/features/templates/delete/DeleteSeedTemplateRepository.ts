import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { seedTemplates } from "~/shared/node/db/schema.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { DeleteSeedTemplateRepository as Abstraction } from "./abstractions/DeleteSeedTemplateRepository.js";

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

class DeleteSeedTemplateRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<void, ProjectNotFoundError | ProjectPersistenceError>> {
    try {
      const existing = this.databaseClient.db
        .select({ id: seedTemplates.id })
        .from(seedTemplates)
        .where(eq(seedTemplates.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      this.databaseClient.db.delete(seedTemplates).where(eq(seedTemplates.id, input.id)).run();

      return Result.ok(undefined);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

export const DeleteSeedTemplateRepository = Abstraction.createImplementation({
  implementation: DeleteSeedTemplateRepositoryImpl,
  dependencies: [DatabaseClient],
});
