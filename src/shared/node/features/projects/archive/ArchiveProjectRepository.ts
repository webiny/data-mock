import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ArchiveProjectRepository as Abstraction } from "./abstractions/ArchiveProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

/**
 * Soft-deletes a project, and restores it. Nothing is removed: every child row still hangs off
 * this project and comes back untouched on restore.
 *
 * Archiving an already-archived project keeps the ORIGINAL `archivedAt` — the timestamp records
 * when the project left service, and a repeated call must not move it.
 */
class ArchiveProjectRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

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

      const archivedAt = input.archived ? (existing.archivedAt ?? Date.now()) : null;

      if (archivedAt === existing.archivedAt) {
        return Result.ok(toProject(existing));
      }

      const updatedAt = Date.now();

      this.databaseClient.db
        .update(projects)
        .set({ archivedAt, updatedAt })
        .where(eq(projects.id, input.id))
        .run();

      return Result.ok(toProject({ ...existing, archivedAt, updatedAt }));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toProjectError(error)));
    }
  }
}

export const ArchiveProjectRepository = Abstraction.createImplementation({
  implementation: ArchiveProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
