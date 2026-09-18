import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import type { EnvironmentRef } from "~/shared/types.js";

interface IUploadFileInput {
  tenant: string;
  fileName: string;
  fileContent: string;
  fileType?: string;
}

export interface IPullFilesResult {
  synced: number;
}

export interface IFilesGateway {
  list(ref: EnvironmentRef): Promise<Result<ProjectFile[], HTTPError>>;
  upload(ref: EnvironmentRef, input: IUploadFileInput): Promise<Result<ProjectFile, HTTPError>>;
  remove(ref: EnvironmentRef, fileId: string): Promise<Result<void, HTTPError>>;
  pullFiles(ref: EnvironmentRef, tenant: string): Promise<Result<IPullFilesResult, HTTPError>>;
}

export const FilesGateway = createAbstraction<IFilesGateway>("Ui/FilesGateway");

export namespace FilesGateway {
  export type Interface = IFilesGateway;
  export type UploadInput = IUploadFileInput;
}
