import { Result } from "@webiny/stdlib";
import { and, eq } from "drizzle-orm";
import { projectTenants } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { UpdateProjectTenantRepository as Abstraction } from "./abstractions/UpdateProjectTenantRepository.js";
import { ProjectPersistenceError, TenantNotFoundError } from "~/shared/errors.js";
import type { ProjectTenant } from "~/shared/types.js";

class UpdateProjectTenantRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectTenant, Abstraction.Error>> {
    try {
      const { db } = this.databaseClient;
      const where = and(
        eq(projectTenants.environmentId, input.environmentId),
        eq(projectTenants.tenantId, input.tenantId),
      );

      const existing = db.select().from(projectTenants).where(where).get();
      if (!existing) {
        return Result.fail(new TenantNotFoundError(input.tenantId));
      }

      db.update(projectTenants)
        .set({
          apiToken: input.apiToken === null ? null : this.encryptionService.encrypt(input.apiToken),
        })
        .where(where)
        .run();

      return Result.ok({ ...existing, apiToken: input.apiToken });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const UpdateProjectTenantRepository = Abstraction.createImplementation({
  implementation: UpdateProjectTenantRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
