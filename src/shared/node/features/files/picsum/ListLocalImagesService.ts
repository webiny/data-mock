import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@webiny/stdlib";
import { ListLocalImagesService as Abstraction } from "./abstractions/ListLocalImagesService.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import type { ILocalImageFile } from "./abstractions/ListLocalImagesService.js";
import { LOCAL_IMAGES_DIR } from "~/shared/node/features/files/local/localFilePaths.js";

const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

class ListLocalImagesServiceImpl implements Abstraction.Interface {
  public async execute(
    _input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    try {
      if (!existsSync(LOCAL_IMAGES_DIR)) {
        return Result.ok({ files: [] });
      }

      const entries = readdirSync(LOCAL_IMAGES_DIR);
      const files: ILocalImageFile[] = [];

      for (const fileName of entries) {
        const fileType = guessImageContentType(fileName);
        if (!fileType) {
          continue;
        }

        const filePath = join(LOCAL_IMAGES_DIR, fileName);
        const stats = statSync(filePath);
        if (!stats.isFile()) {
          continue;
        }

        files.push({
          filePath,
          fileName,
          fileType,
          fileSize: stats.size,
        });
      }

      return Result.ok({ files });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }
  }
}

function guessImageContentType(fileName: string): string | undefined {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_TYPES[ext];
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const ListLocalImagesService = Abstraction.createImplementation({
  implementation: ListLocalImagesServiceImpl,
  dependencies: [],
});
