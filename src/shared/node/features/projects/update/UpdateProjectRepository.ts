import { Result } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projects } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { UpdateProjectRepository as Abstraction } from "./abstractions/UpdateProjectRepository.js";
import { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";
import { toProject, toProjectError } from "../toProject.js";
import type { Project } from "~/shared/types.js";

type ProjectUpdate = Partial<typeof projects.$inferInsert>;

class UpdateProjectRepositoryImpl implements Abstraction.Interface {
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

      const updates: ProjectUpdate = { updatedAt: Date.now() };

      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.rootPath !== undefined) {
        updates.rootPath = input.rootPath;
      }
      if (input.webinyVersion !== undefined) {
        updates.webinyVersion = input.webinyVersion;
      }
      if (input.versionSource !== undefined) {
        updates.versionSource = input.versionSource;
      }
      if (input.versionMajor !== undefined) {
        updates.versionMajor = input.versionMajor;
      }
      if (input.operationsVersion !== undefined) {
        updates.operationsVersion = input.operationsVersion;
      }
      if (input.pulumiBackend !== undefined) {
        updates.pulumiBackend = input.pulumiBackend;
      }
      if (input.awsProfile !== undefined) {
        updates.awsProfile = input.awsProfile;
      }
      if (input.awsRegion !== undefined) {
        updates.awsRegion = input.awsRegion;
      }
      if (input.lastSyncedAt !== undefined) {
        updates.lastSyncedAt = input.lastSyncedAt;
      }
      if (input.lastSyncStatus !== undefined) {
        updates.lastSyncStatus = input.lastSyncStatus;
      }

      this.databaseClient.db.update(projects).set(updates).where(eq(projects.id, input.id)).run();

      const updated = this.databaseClient.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get()!;

      return Result.ok(toProject(updated));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toProjectError(error)));
    }
  }
}

export const UpdateProjectRepository = Abstraction.createImplementation({
  implementation: UpdateProjectRepositoryImpl,
  dependencies: [DatabaseClient],
});
