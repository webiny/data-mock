import { and, eq, isNotNull, ne } from "drizzle-orm";
import path from "node:path";
import { projects } from "~/shared/node/db/schema.js";
import { ValidationError } from "~/shared/errors.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";

interface IUniquenessInput {
  name?: string | undefined;
  rootPath?: string | null | undefined;
  /** The project being updated, so it does not collide with itself. */
  excludeId?: string | undefined;
}

/**
 * Refuses a second project with the same name, or a second one pointing at the same checkout.
 *
 * Neither was enforced, and both bite. Two rows for one checkout means two inventories of the same
 * stacks, each overwriting the other on sync, and only one of them is the row anyone is looking at.
 * Two rows with one name means every list, badge and destroy confirmation is ambiguous — and the
 * destroy dialog asks for the name typed back.
 *
 * Archived projects count: they still exist, and restoring one would resurrect the collision.
 */
export function checkProjectIsUnique(
  databaseClient: DatabaseClient.Interface,
  input: IUniquenessInput,
): ValidationError | null {
  const { db } = databaseClient;

  if (input.name !== undefined) {
    const clash = db
      .select({ id: projects.id })
      .from(projects)
      .where(
        input.excludeId === undefined
          ? eq(projects.name, input.name)
          : and(eq(projects.name, input.name), ne(projects.id, input.excludeId)),
      )
      .get();

    if (clash !== undefined) {
      return new ValidationError(`A project named "${input.name}" already exists.`);
    }
  }

  if (input.rootPath !== undefined && input.rootPath !== null) {
    const resolved = path.resolve(input.rootPath);
    const rows = db
      .select({ id: projects.id, rootPath: projects.rootPath })
      .from(projects)
      .where(isNotNull(projects.rootPath))
      .all();

    const clash = rows.find(
      (row) =>
        row.id !== input.excludeId &&
        row.rootPath !== null &&
        path.resolve(row.rootPath) === resolved,
    );

    if (clash !== undefined) {
      return new ValidationError(`Another project already uses the checkout at "${resolved}".`);
    }
  }

  return null;
}
