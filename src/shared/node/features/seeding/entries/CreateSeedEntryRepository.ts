import { Result } from "@webiny/stdlib";
import { generateId } from "@webiny/stdlib";
import { seedEntries } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { CreateSeedEntryRepository as Abstraction } from "./abstractions/CreateSeedEntryRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { SeedEntry } from "~/shared/types.js";

class CreateSeedEntryRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedEntry, Abstraction.Error>> {
    try {
      const now = Date.now();
      const id = generateId();

      this.databaseClient.db
        .insert(seedEntries)
        .values({
          id,
          jobId: input.jobId,
          projectId: input.projectId,
          tenant: input.tenant,
          modelId: input.modelId,
          entryId: input.entryId,
          entryData: JSON.stringify(input.entryData),
          responseData: input.responseData ? JSON.stringify(input.responseData) : null,
          httpStatus: input.httpStatus,
          status: input.status,
          error: input.error,
          createdAt: now,
        })
        .run();

      return Result.ok({
        id,
        jobId: input.jobId,
        projectId: input.projectId,
        tenant: input.tenant,
        modelId: input.modelId,
        entryId: input.entryId,
        entryData: input.entryData,
        responseData: input.responseData,
        httpStatus: input.httpStatus,
        status: input.status,
        error: input.error,
        createdAt: now,
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const CreateSeedEntryRepository = Abstraction.createImplementation({
  implementation: CreateSeedEntryRepositoryImpl,
  dependencies: [DatabaseClient],
});
