import { Result } from "@webiny/stdlib";
import { eq, and } from "drizzle-orm";
import { projectFiles } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectFilesRepository as Abstraction } from "./abstractions/ListProjectFilesRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectFile } from "~/shared/types.js";

class ListProjectFilesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectFile[], Abstraction.Error>> {
    try {
      const conditions = [eq(projectFiles.projectId, input.projectId)];

      if (input.tenant) {
        conditions.push(eq(projectFiles.tenant, input.tenant));
      }
      if (input.fileType) {
        conditions.push(eq(projectFiles.fileType, input.fileType));
      }

      const rows = this.databaseClient.db
        .select()
        .from(projectFiles)
        .where(and(...conditions))
        .all();

      return Result.ok(rows);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListProjectFilesRepository = Abstraction.createImplementation({
  implementation: ListProjectFilesRepositoryImpl,
  dependencies: [DatabaseClient],
});
