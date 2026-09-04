import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ILocalFileUploadedProjectVM {
  projectId: string;
  projectName: string;
}

export interface ILocalFileVM {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedToProjects: ILocalFileUploadedProjectVM[];
}

export interface ILocalFileUploadInput {
  fileName: string;
  fileContent: string;
}

export interface ILocalFilesPullPicsumInput {
  count: number;
  width?: number;
  height?: number;
}

export interface ILocalFilesUploadGlobalToProjectInput {
  tenant: string;
  fileNames?: string[];
}

export interface ILocalFilesGateway {
  list(): Promise<Result<ILocalFileVM[], HTTPError>>;
  upload(input: ILocalFileUploadInput): Promise<Result<ILocalFileVM, HTTPError>>;
  remove(fileName: string): Promise<Result<void, HTTPError>>;
  pullPicsum(input: ILocalFilesPullPicsumInput): Promise<Result<{ downloaded: number }, HTTPError>>;
  uploadGlobalToProject(
    projectId: string,
    input: ILocalFilesUploadGlobalToProjectInput,
  ): Promise<Result<Job, HTTPError>>;
}

export const LocalFilesGateway = createAbstraction<ILocalFilesGateway>("Ui/LocalFilesGateway");

export namespace LocalFilesGateway {
  export type Interface = ILocalFilesGateway;
  export type FileVM = ILocalFileVM;
  export type UploadedProjectVM = ILocalFileUploadedProjectVM;
  export type UploadInput = ILocalFileUploadInput;
  export type PullPicsumInput = ILocalFilesPullPicsumInput;
  export type UploadGlobalToProjectInput = ILocalFilesUploadGlobalToProjectInput;
}
