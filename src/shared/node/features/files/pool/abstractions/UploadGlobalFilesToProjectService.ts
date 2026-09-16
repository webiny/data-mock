import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
} from "~/shared/errors.js";

export interface IUploadGlobalFilesToProjectServiceInput {
  environmentId: string;
  tenant: string;
  fileNames?: string[] | undefined;
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

export interface IUploadFailure {
  fileName: string;
  error: string;
}

export interface IUploadGlobalFilesToProjectServiceOutput {
  uploaded: number;
  /**
   * Files that could not be uploaded. Reported rather than only logged: the caller is a job, and
   * "Uploaded 1 file(s)." over nine failures is a success message for a run that mostly failed.
   */
  failures: IUploadFailure[];
  files: ProjectFile[];
}

export interface IUploadGlobalFilesToProjectService {
  execute(
    input: UploadGlobalFilesToProjectService.Input,
  ): Promise<
    Result<UploadGlobalFilesToProjectService.Output, UploadGlobalFilesToProjectService.Error>
  >;
}

export const UploadGlobalFilesToProjectService =
  createAbstraction<IUploadGlobalFilesToProjectService>("Files/UploadGlobalFilesToProjectService");

export namespace UploadGlobalFilesToProjectService {
  export type Interface = IUploadGlobalFilesToProjectService;
  export type Input = IUploadGlobalFilesToProjectServiceInput;
  export type Output = IUploadGlobalFilesToProjectServiceOutput;
  export type Failure = IUploadFailure;
  export type Error = ProjectPersistenceError | ProjectNotFoundError | GraphQLRequestError;
}
