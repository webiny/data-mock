import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface IDeleteLocalFileServiceInput {
  fileName: string;
}

export type IDeleteLocalFileServiceOutput = Record<string, never>;

export interface IDeleteLocalFileService {
  execute(
    input: DeleteLocalFileService.Input,
  ): Promise<Result<DeleteLocalFileService.Output, DeleteLocalFileService.Error>>;
}

export const DeleteLocalFileService = createAbstraction<IDeleteLocalFileService>(
  "Files/DeleteLocalFileService",
);

export namespace DeleteLocalFileService {
  export type Interface = IDeleteLocalFileService;
  export type Input = IDeleteLocalFileServiceInput;
  export type Output = IDeleteLocalFileServiceOutput;
  export type Error = ValidationError | ProjectPersistenceError;
}
