import { Result } from "@webiny/stdlib";
import { eq, and, asc, desc, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { projectFiles } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { ListProjectFilesRepository as Abstraction } from "./abstractions/ListProjectFilesRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

const PROJECT_FILE_SORT_COLUMNS = {
  uploadedAt: projectFiles.uploadedAt,
  fileName: projectFiles.fileName,
} as const;

type ProjectFileSortField = keyof typeof PROJECT_FILE_SORT_COLUMNS;

function isProjectFileSortField(value: string | undefined): value is ProjectFileSortField {
  return value !== undefined && Object.hasOwn(PROJECT_FILE_SORT_COLUMNS, value);
}

class ListProjectFilesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      const conditions: SQL[] = [eq(projectFiles.projectId, input.projectId)];

      if (input.tenant) {
        conditions.push(eq(projectFiles.tenant, input.tenant));
      }
      if (input.fileType) {
        conditions.push(eq(projectFiles.fileType, input.fileType));
      }

      const whereClause = and(...conditions)!;

      const totalResult = this.databaseClient.db
        .select({ total: count() })
        .from(projectFiles)
        .where(whereClause)
        .all();
      const total = totalResult[0]?.total ?? 0;

      const sortColumn = isProjectFileSortField(input.sortField)
        ? PROJECT_FILE_SORT_COLUMNS[input.sortField]
        : projectFiles.uploadedAt;
      const orderBy = input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

      const limit = input.limit ?? 50;
      const offset = input.offset ?? 0;

      const rows = this.databaseClient.db
        .select()
        .from(projectFiles)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .all();

      return Result.ok({ files: rows, total });
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
