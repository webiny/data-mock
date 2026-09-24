import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { GetEnvironmentRepository as Abstraction } from "./abstractions/GetEnvironmentRepository.js";
import { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironment, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectEnvironment } from "~/shared/types.js";

class GetEnvironmentRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectEnvironment, Abstraction.Error>> {
    try {
      const row = this.databaseClient.db
        .select()
        .from(projectEnvironments)
        .where(eq(projectEnvironments.id, input.id))
        .get();

      if (!row) {
        return Result.fail(new EnvironmentNotFoundError(input.id));
      }

      const apiToken = row.apiToken === null ? null : this.encryptionService.decrypt(row.apiToken);

      return Result.ok(toEnvironment(row, apiToken));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const GetEnvironmentRepository = Abstraction.createImplementation({
  implementation: GetEnvironmentRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
