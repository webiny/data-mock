import { mkdirSync, writeFileSync } from "node:fs";
import { Result } from "@webiny/stdlib";
import { SaveLocalFileService as Abstraction } from "./abstractions/SaveLocalFileService.js";
import { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";
import {
  LOCAL_IMAGES_DIR,
  isSafeLocalFileName,
  resolveLocalFilePath,
  guessLocalFileContentType,
} from "./localFilePaths.js";

class SaveLocalFileServiceImpl implements Abstraction.Interface {
  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    if (!isSafeLocalFileName(input.fileName)) {
      return Result.fail(new ValidationError(`Invalid file name "${input.fileName}".`));
    }

    try {
      mkdirSync(LOCAL_IMAGES_DIR, { recursive: true });
      const filePath = resolveLocalFilePath(input.fileName);
      const buffer = Buffer.from(input.fileContent, "base64");
      writeFileSync(filePath, buffer);

      return Result.ok({
        fileName: input.fileName,
        fileType: guessLocalFileContentType(input.fileName),
        fileSize: buffer.length,
      });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const SaveLocalFileService = Abstraction.createImplementation({
  implementation: SaveLocalFileServiceImpl,
  dependencies: [],
});
