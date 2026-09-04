import { Result, generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { projectTenants } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { SyncProjectTenantsRepository as Abstraction } from "./abstractions/SyncProjectTenantsRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectTenant } from "~/shared/types.js";

class SyncProjectTenantsRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectTenant[], Abstraction.Error>> {
    try {
      const { db } = this.databaseClient;
      const now = Date.now();

      db.delete(projectTenants).where(eq(projectTenants.projectId, input.projectId)).run();

      const rows: ProjectTenant[] = input.tenants.map((t) => ({
        id: generateId(),
        projectId: input.projectId,
        tenantId: t.tenantId,
        name: t.name,
        discoveredAt: now,
      }));

      for (const row of rows) {
        db.insert(projectTenants).values(row).run();
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

export const SyncProjectTenantsRepository = Abstraction.createImplementation({
  implementation: SyncProjectTenantsRepositoryImpl,
  dependencies: [DatabaseClient],
});
