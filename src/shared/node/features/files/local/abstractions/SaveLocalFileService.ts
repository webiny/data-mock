import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface ISaveLocalFileServiceInput {
  fileName: string;
  fileContent: string;
}

export interface ISaveLocalFileServiceOutput {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface ISaveLocalFileService {
  execute(
    input: SaveLocalFileService.Input,
  ): Promise<Result<SaveLocalFileService.Output, SaveLocalFileService.Error>>;
}

export const SaveLocalFileService = createAbstraction<ISaveLocalFileService>(
  "Files/SaveLocalFileService",
);

export namespace SaveLocalFileService {
  export type Interface = ISaveLocalFileService;
  export type Input = ISaveLocalFileServiceInput;
  export type Output = ISaveLocalFileServiceOutput;
  export type Error = ValidationError | ProjectPersistenceError;
}
