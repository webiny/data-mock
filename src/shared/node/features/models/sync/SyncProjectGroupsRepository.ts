import { Result, generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectGroups } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { SyncProjectGroupsRepository as Abstraction } from "./abstractions/SyncProjectGroupsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectGroup } from "~/shared/types.js";

class SyncProjectGroupsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectGroup[], Abstraction.Error>> {
    try {
      const { db } = this.databaseClient;
      const now = Date.now();

      db.delete(projectGroups).where(eq(projectGroups.projectId, input.projectId)).run();

      const rows: ProjectGroup[] = input.groups.map((g) => ({
        id: generateId(),
        projectId: input.projectId,
        slug: g.slug,
        name: g.name,
        description: g.description ?? null,
        icon: g.icon ?? null,
        remoteId: g.remoteId ?? null,
        syncedAt: now,
        createdAt: now,
      }));

      for (const row of rows) {
        db.insert(projectGroups).values(row).run();
      }

      return Result.ok(rows);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const SyncProjectGroupsRepository = Abstraction.createImplementation({
  implementation: SyncProjectGroupsRepositoryImpl,
  dependencies: [DatabaseClient],
});
