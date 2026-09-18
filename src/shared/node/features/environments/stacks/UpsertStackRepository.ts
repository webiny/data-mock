import { Result, generateId } from "@webiny/stdlib";
import { and, eq } from "drizzle-orm";
import { projectStacks } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { UpsertStackRepository as Abstraction } from "./abstractions/UpsertStackRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toStack, toEnvironmentError } from "../toEnvironment.js";
import { mergeStackRead } from "~/shared/stackOutput/stackState.js";
import type { ProjectStack } from "~/shared/types.js";

class UpsertStackRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<ProjectStack, Abstraction.Error>> {
    try {
      const now = Date.now();

      const existing = this.databaseClient.db
        .select()
        .from(projectStacks)
        .where(
          and(
            eq(projectStacks.environmentId, input.environmentId),
            eq(projectStacks.app, input.app),
          ),
        )
        .get();

      /**
       * What the row becomes is decided by `mergeStackRead`, the same function the sync preview
       * runs to predict this write. Deciding it here as well is how the preview and the write
       * would drift.
       */
      const merged = mergeStackRead(input.app, existing === undefined ? null : toStack(existing), {
        readState: input.readState,
        deployed: input.deployed,
        resourceCount: input.resourceCount ?? null,
        outputs: input.stackOutput ?? null,
      });

      const stackOutput = merged.stackOutput === null ? null : JSON.stringify(merged.stackOutput);

      if (existing) {
        this.databaseClient.db
          .update(projectStacks)
          .set({
            readState: merged.readState,
            deployed: merged.deployed ? 1 : 0,
            resourceCount: merged.resourceCount,
            stackOutput,
            syncedAt: now,
          })
          .where(eq(projectStacks.id, existing.id))
          .run();

        const updated = this.databaseClient.db
          .select()
          .from(projectStacks)
          .where(eq(projectStacks.id, existing.id))
          .get()!;

        return Result.ok(toStack(updated));
      }

      const row = {
        id: generateId(),
        environmentId: input.environmentId,
        app: input.app,
        deployed: merged.deployed ? 1 : 0,
        resourceCount: merged.resourceCount,
        stackOutput,
        readState: merged.readState,
        syncedAt: now,
      };

      this.databaseClient.db.insert(projectStacks).values(row).run();

      return Result.ok(toStack(row));
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toEnvironmentError(error)));
    }
  }
}

export const UpsertStackRepository = Abstraction.createImplementation({
  implementation: UpsertStackRepositoryImpl,
  dependencies: [DatabaseClient],
});
