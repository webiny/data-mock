import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "~/shared/node/encryption/abstractions/EncryptionService.js";
import { UpdateProjectRepository as Abstraction } from "./abstractions/UpdateProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import type { Project } from "~/shared/types.js";

class UpdateProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly encryptionService: EncryptionService.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<Project, Abstraction.Error>> {
    try {
      const existing = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!existing) {
        return Result.fail(new ProjectNotFoundError(input.id));
      }

      const updates: Record<string, unknown> = { updatedAt: Date.now() };

      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.apiUrl !== undefined) {
        updates.apiUrl = input.apiUrl;
      }
      if (input.apiToken !== undefined) {
        updates.apiToken = this.encryptionService.encrypt(input.apiToken);
      }
      if (input.tenant !== undefined) {
        updates.tenant = input.tenant;
      }
      if (input.webinyVersion !== undefined) {
        updates.webinyVersion = input.webinyVersion;
      }

      this.databaseClient.db.update(projects).set(updates).where(eq(projects.id, input.id)).run();

      const updated = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get()!;

      return Result.ok({ ...updated, apiToken: this.encryptionService.decrypt(updated.apiToken) });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const UpdateProjectRepository = Abstraction.createImplementation({
  implementation: UpdateProjectRepositoryImpl,
  dependencies: [DatabaseClient, EncryptionService],
});
