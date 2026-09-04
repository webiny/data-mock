import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { seedTemplates } from "~/shared/node/db/schema.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { ListSeedTemplatesRepository as Abstraction } from "./abstractions/ListSeedTemplatesRepository.js";
import type { SeedTemplate, SeedTemplateConfig } from "~/shared/types.js";

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

class ListSeedTemplatesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<SeedTemplate[], ProjectPersistenceError>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(seedTemplates)
        .where(eq(seedTemplates.projectId, input.projectId))
        .all();

      return Result.ok(
        rows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          name: row.name,
          config: JSON.parse(row.config) as SeedTemplateConfig,
          createdAt: row.createdAt,
        })),
      );
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

export const ListSeedTemplatesRepository = Abstraction.createImplementation({
  implementation: ListSeedTemplatesRepositoryImpl,
  dependencies: [DatabaseClient],
});
