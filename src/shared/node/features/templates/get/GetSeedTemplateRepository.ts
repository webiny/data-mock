import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { seedTemplates } from "~/shared/node/db/schema.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { GetSeedTemplateRepository as Abstraction } from "./abstractions/GetSeedTemplateRepository.js";
import type { SeedTemplate, SeedTemplateConfig } from "~/shared/types.js";

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

class GetSeedTemplateRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<SeedTemplate, ProjectNotFoundError | ProjectPersistenceError>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(seedTemplates)
        .where(eq(seedTemplates.id, input.id))
        .get();

      if (!row) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      return Result.ok({
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        config: JSON.parse(row.config) as SeedTemplateConfig,
        createdAt: row.createdAt,
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

export const GetSeedTemplateRepository = Abstraction.createImplementation({
  implementation: GetSeedTemplateRepositoryImpl,
  dependencies: [DatabaseClient],
});
