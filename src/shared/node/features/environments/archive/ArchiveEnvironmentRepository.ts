import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectEnvironments } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { ArchiveEnvironmentRepository as Abstraction } from "./abstractions/ArchiveEnvironmentRepository.js";
import { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toEnvironment, toEnvironmentError } from "../toEnvironment.js";
import type { ProjectEnvironment } from "~/shared/types.js";

/**
 * Soft-deletes an environment, and restores it. The row keeps its place in the
 * (project, env, variant) unique index while archived, so sync cannot insert a second row for the
 * same stack name beside it.
 */
class ArchiveEnvironmentRepositoryImpl implements Abstraction.Interface {
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

      const apiToken =
        existing.apiToken === null ? null : this.encryptionService.decrypt(existing.apiToken);

      const archivedAt = input.archived ? (existing.archivedAt ?? Date.now()) : null;

      if (archivedAt === existing.archivedAt) {
        return Result.ok(toEnvironment(existing, apiToken));
      }

      const updatedAt = Date.now();

      this.databaseClient.db
        .update(projectEnvironments)
        .set({ archivedAt, updatedAt })
        .where(eq(projectEnvironments.id, input.id))
        .run();

      return Result.ok(toEnvironment({ ...existing, archivedAt, updatedAt }, apiToken));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const ArchiveEnvironmentRepository = Abstraction.createImplementation({
  implementation: ArchiveEnvironmentRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
