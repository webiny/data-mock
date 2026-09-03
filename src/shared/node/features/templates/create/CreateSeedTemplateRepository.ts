import { Result } from "@webiny/stdlib";
import { generateId } from "@webiny/stdlib";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { seedTemplates } from "~/shared/node/db/schema.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { CreateSeedTemplateRepository as Abstraction } from "./abstractions/CreateSeedTemplateRepository.js";
import type { SeedTemplate } from "~/shared/types.js";

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

class CreateSeedTemplateRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<SeedTemplate, ProjectPersistenceError>> {
    try {
      const id = generateId();
      const now = Date.now();

      this.databaseClient.db
        .insert(seedTemplates)
        .values({
          id,
          projectId: input.projectId,
          name: input.name,
          config: JSON.stringify(input.config),
          createdAt: now,
        })
        .run();

      return Result.ok({
        id,
        projectId: input.projectId,
        name: input.name,
        config: input.config,
        createdAt: now,
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

export const CreateSeedTemplateRepository = Abstraction.createImplementation({
  implementation: CreateSeedTemplateRepositoryImpl,
  dependencies: [DatabaseClient],
});
