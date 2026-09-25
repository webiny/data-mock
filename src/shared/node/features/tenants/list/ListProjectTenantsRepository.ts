import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectTenants } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { ListProjectTenantsRepository as Abstraction } from "./abstractions/ListProjectTenantsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectTenant } from "~/shared/types.js";

class ListProjectTenantsRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectTenant[], Abstraction.Error>> {
    try {
      const rows = this.databaseClient.db
        .select()
        .from(projectTenants)
        .where(eq(projectTenants.environmentId, input.environmentId))
        .all();

      return Result.ok(
        rows.map((row) => ({
          ...row,
          apiToken: row.apiToken === null ? null : this.encryptionService.decrypt(row.apiToken),
        })),
      );
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListProjectTenantsRepository = Abstraction.createImplementation({
  implementation: ListProjectTenantsRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
