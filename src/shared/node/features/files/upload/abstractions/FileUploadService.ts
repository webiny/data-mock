import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type {
  EnvironmentNotFoundError,
  EnvironmentNotConnectedError,
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
} from "~/shared/errors.js";

export interface IFileUploadServiceInput {
  environmentId: string;
  tenant: string;
  filePath: string;
}

export interface IFileUploadServiceOutput {
  file: ProjectFile;
}

export interface IFileUploadService {
  execute(
    input: FileUploadService.Input,
  ): Promise<Result<FileUploadService.Output, FileUploadService.Error>>;
}

export const FileUploadService = createAbstraction<IFileUploadService>("Files/FileUploadService");

export namespace FileUploadService {
  export type Interface = IFileUploadService;
  export type Input = IFileUploadServiceInput;
  export type Output = IFileUploadServiceOutput;
  export type Error =
    | EnvironmentNotFoundError
    | EnvironmentNotConnectedError
    | ProjectNotFoundError
    | ProjectPersistenceError
    | GraphQLRequestError;
}
