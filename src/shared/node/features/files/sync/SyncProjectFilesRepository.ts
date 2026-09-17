import { Result, generateId } from "@webiny/stdlib";
import { eq, and } from "drizzle-orm";
import { projectFiles } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { SyncProjectFilesRepository as Abstraction } from "./abstractions/SyncProjectFilesRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectFile } from "~/shared/types.js";

class SyncProjectFilesRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<ProjectFile[], Abstraction.Error>> {
    try {
      const { db } = this.databaseClient;
      const now = Date.now();

      const rows: ProjectFile[] = input.files.map((file) => ({
        id: generateId(),
        projectId: input.projectId,
        environmentId: input.environmentId,
        tenant: input.tenant,
        fileKey: file.fileKey,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadedAt: now,
      }));

      /**
       * Delete and re-insert as one unit. Run loose, a failure part-way through leaves the
       * environment holding fewer rows than it started with — the delete has already happened and
       * the inserts that replace them have not.
       */
      db.transaction((tx) => {
        tx.delete(projectFiles)
          .where(
            and(
              eq(projectFiles.environmentId, input.environmentId),
              eq(projectFiles.tenant, input.tenant),
            ),
          )
          .run();

        for (const row of rows) {
          tx.insert(projectFiles).values(row).run();
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

export const SyncProjectFilesRepository = Abstraction.createImplementation({
  implementation: SyncProjectFilesRepositoryImpl,
  dependencies: [DatabaseClient],
});
