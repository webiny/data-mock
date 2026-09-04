import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
} from "~/shared/errors.js";

export interface IUploadGlobalFilesToProjectServiceInput {
  projectId: string;
  tenant: string;
}

export interface IUploadGlobalFilesToProjectServiceOutput {
  uploaded: number;
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
  export type Error = ProjectPersistenceError | ProjectNotFoundError | GraphQLRequestError;
}
