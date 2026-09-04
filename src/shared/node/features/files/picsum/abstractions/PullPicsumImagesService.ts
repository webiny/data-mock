import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IPullPicsumImagesServiceInput {
  count: number;
  width?: number;
  height?: number;
  onProgress?: (percent: number, label: string) => void;
}

export interface IPullPicsumImagesServiceOutput {
  downloaded: number;
  directory: string;
  files: string[];
}

export interface IPullPicsumImagesService {
  execute(
    input: PullPicsumImagesService.Input,
  ): Promise<Result<PullPicsumImagesService.Output, PullPicsumImagesService.Error>>;
}

export const PullPicsumImagesService = createAbstraction<IPullPicsumImagesService>(
  "Files/PullPicsumImagesService",
);

export namespace PullPicsumImagesService {
  export type Interface = IPullPicsumImagesService;
  export type Input = IPullPicsumImagesServiceInput;
  export type Output = IPullPicsumImagesServiceOutput;
  export type Error = ProjectPersistenceError;
}
