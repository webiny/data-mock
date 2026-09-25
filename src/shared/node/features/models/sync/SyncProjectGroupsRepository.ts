import { Result, generateId } from "@webiny/stdlib";
import { and, eq } from "drizzle-orm";
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

      const rows: ProjectGroup[] = input.groups.map((group) => ({
        id: generateId(),
        projectId: input.projectId,
        environmentId: input.environmentId,
        tenant: input.tenant,
        slug: group.slug,
        name: group.name,
        description: group.description ?? null,
        icon: group.icon ?? null,
        remoteId: group.remoteId ?? null,
        syncedAt: now,
        createdAt: now,
      }));

      /**
       * Delete and re-insert as one unit. Run loose, a failure part-way through leaves the
       * environment holding fewer rows than it started with — the delete has already happened and
       * the inserts that replace them have not.
       */
      db.transaction((tx) => {
        tx.delete(projectGroups)
          .where(
            and(
              eq(projectGroups.environmentId, input.environmentId),
              eq(projectGroups.tenant, input.tenant),
            ),
          )
          .run();

        for (const row of rows) {
          tx.insert(projectGroups).values(row).run();
        }
      });

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
