import { Result, generateId } from "@webiny/stdlib";
import { and, eq } from "drizzle-orm";
import { projectStacks } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { UpsertStackRepository as Abstraction } from "./abstractions/UpsertStackRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { toStack, toEnvironmentError } from "../toEnvironment.js";
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
       * An "unknown" read means the stack file was missing, unreadable or unparseable. Writing
       * nulls over a previously-good `stackOutput` would lose the only record of what is deployed,
       * so only the read state and timestamp are updated.
       */
      const isUnknown = input.readState === "unknown";

      if (existing) {
        this.databaseClient.db
          .update(projectStacks)
          .set({
            readState: input.readState,
            deployed: input.deployed ? 1 : 0,
            syncedAt: now,
            ...(isUnknown
              ? {}
              : {
                  resourceCount: input.resourceCount ?? null,
                  stackOutput:
                    input.stackOutput === undefined || input.stackOutput === null
                      ? null
                      : JSON.stringify(input.stackOutput),
                }),
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
        deployed: input.deployed ? 1 : 0,
        resourceCount: isUnknown ? null : (input.resourceCount ?? null),
        stackOutput:
          isUnknown || input.stackOutput === undefined || input.stackOutput === null
            ? null
            : JSON.stringify(input.stackOutput),
        readState: input.readState,
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
