import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Logger, generateId } from "@webiny/stdlib";
import { PullPicsumImagesService as Abstraction } from "./abstractions/PullPicsumImagesService.js";
import { ProjectPersistenceError } from "~/shared/errors.js";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DOWNLOAD_DELAY_MS = 200;
const IMAGES_DIR = join(process.cwd(), ".webiny", "images");

class PullPicsumImagesServiceImpl implements Abstraction.Interface {
  public constructor(private readonly logger: Logger.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const width = input.width ?? DEFAULT_WIDTH;
    const height = input.height ?? DEFAULT_HEIGHT;

    try {
      mkdirSync(IMAGES_DIR, { recursive: true });
    } catch (error) {
      return Result.fail(new ProjectPersistenceError(toError(error)));
    }

    const files: string[] = [];

    for (let i = 0; i < input.count; i++) {
      try {
        const response = await fetch(`https://picsum.photos/${width}/${height}`);
        if (!response.ok) {
          this.logger.warn(
            `Failed to download picsum image ${i + 1}/${input.count}: HTTP ${response.status}`,
          );
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const fileName = `picsum-${generateId()}.jpg`;
          const filePath = join(IMAGES_DIR, fileName);
          writeFileSync(filePath, Buffer.from(arrayBuffer));

          files.push(fileName);
          this.logger.info(`Downloaded picsum image ${i + 1}/${input.count}: ${fileName}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to download picsum image ${i + 1}/${input.count}: ${toError(error).message}`,
        );
      }

      if (i < input.count - 1) {
        await delay(DOWNLOAD_DELAY_MS);
      }
    }

    return Result.ok({ downloaded: files.length, directory: IMAGES_DIR, files });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const PullPicsumImagesService = Abstraction.createImplementation({
  implementation: PullPicsumImagesServiceImpl,
  dependencies: [Logger],
});
