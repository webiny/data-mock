import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { UpdateEnvironmentRepository as Abstraction } from "./abstractions/UpdateEnvironmentRepository.js";
import { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironment, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectEnvironment } from "~/shared/types.js";

type EnvironmentUpdate = Partial<typeof projectEnvironments.$inferInsert>;

class UpdateEnvironmentRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectEnvironment, Abstraction.Error>> {
    try {
      const existing = this.databaseClient.db
        .select()
        .from(projectEnvironments)
        .where(eq(projectEnvironments.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new EnvironmentNotFoundError(input.id));
      }

      const updates: EnvironmentUpdate = { updatedAt: Date.now() };

      if (input.region !== undefined) {
        updates.region = input.region;
      }
      if (input.deployed !== undefined) {
        updates.deployed = input.deployed ? 1 : 0;
      }
      if (input.apiUrl !== undefined) {
        updates.apiUrl = input.apiUrl;
      }
      if (input.adminUrl !== undefined) {
        updates.adminUrl = input.adminUrl;
      }
      if (input.apiToken !== undefined) {
        updates.apiToken =
          input.apiToken === null ? null : this.encryptionService.encrypt(input.apiToken);
      }
      if (input.tenant !== undefined) {
        updates.tenant = input.tenant;
      }
      if (input.lastSyncedAt !== undefined) {
        updates.lastSyncedAt = input.lastSyncedAt;
      }

      this.databaseClient.db
        .update(projectEnvironments)
        .set(updates)
        .where(eq(projectEnvironments.id, input.id))
        .run();

      const updated = this.databaseClient.db
        .select()
        .from(projectEnvironments)
        .where(eq(projectEnvironments.id, input.id))
        .get()!;

      const apiToken =
        updated.apiToken === null ? null : this.encryptionService.decrypt(updated.apiToken);

      return Result.ok(toEnvironment(updated, apiToken));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const UpdateEnvironmentRepository = Abstraction.createImplementation({
  implementation: UpdateEnvironmentRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
