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

      db.delete(projectFiles)
        .where(
          and(eq(projectFiles.projectId, input.projectId), eq(projectFiles.tenant, input.tenant)),
        )
        .run();

      const rows: ProjectFile[] = input.files.map((file) => ({
        id: generateId(),
        projectId: input.projectId,
        tenant: input.tenant,
        fileKey: file.fileKey,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadedAt: now,
      }));

      for (const row of rows) {
        db.insert(projectFiles).values(row).run();
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

export const SyncProjectFilesRepository = Abstraction.createImplementation({
  implementation: SyncProjectFilesRepositoryImpl,
  dependencies: [DatabaseClient],
});
