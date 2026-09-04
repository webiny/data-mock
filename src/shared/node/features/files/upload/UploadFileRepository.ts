import { Result, generateId } from "@webiny/stdlib";
import { projectFiles } from "~/shared/node/db/schema.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { UploadFileRepository as Abstraction } from "./abstractions/UploadFileRepository.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ProjectFile } from "~/shared/types.js";

class UploadFileRepositoryImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<ProjectFile, Abstraction.Error>> {
    try {
      const now = Date.now();
      const id = generateId();

      const row = {
        id,
        projectId: input.projectId,
        tenant: input.tenant,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedAt: now,
      };

      this.databaseClient.db.insert(projectFiles).values(row).run();

      return Result.ok(row);
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const UploadFileRepository = Abstraction.createImplementation({
  implementation: UploadFileRepositoryImpl,
  dependencies: [DatabaseClient],
});
