import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

interface IUploadFileInput {
  tenant: string;
  fileName: string;
  fileContent: string;
  fileType?: string;
}

export interface IFilesGateway {
  list(projectId: string): Promise<Result<ProjectFile[], HTTPError>>;
  upload(projectId: string, input: IUploadFileInput): Promise<Result<ProjectFile, HTTPError>>;
  remove(projectId: string, fileId: string): Promise<Result<void, HTTPError>>;
}

export const FilesGateway = createAbstraction<IFilesGateway>("Ui/FilesGateway");

export namespace FilesGateway {
  export type Interface = IFilesGateway;
  export type UploadInput = IUploadFileInput;
}
