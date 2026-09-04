import { existsSync, unlinkSync } from "node:fs";
import { Result } from "@webiny/stdlib";
import { DeleteLocalFileService as Abstraction } from "./abstractions/DeleteLocalFileService.js";
import { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";
import { isSafeLocalFileName, resolveLocalFilePath } from "./localFilePaths.js";

class DeleteLocalFileServiceImpl implements Abstraction.Interface {
  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    if (!isSafeLocalFileName(input.fileName)) {
      return Result.fail(new ValidationError(`Invalid file name "${input.fileName}".`));
    }

    try {
      const filePath = resolveLocalFilePath(input.fileName);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return Result.ok({});
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const DeleteLocalFileService = Abstraction.createImplementation({
  implementation: DeleteLocalFileServiceImpl,
  dependencies: [],
});
