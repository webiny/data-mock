import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ILocalFileProjectStatus {
  projectId: string;
  projectName: string;
}

export interface ILocalFileWithStatus {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedToProjects: ILocalFileProjectStatus[];
}

export type IListLocalFilesServiceInput = Record<string, never>;

export interface IListLocalFilesServiceOutput {
  files: ILocalFileWithStatus[];
}

export interface IListLocalFilesService {
  execute(
    input: ListLocalFilesService.Input,
  ): Promise<Result<ListLocalFilesService.Output, ListLocalFilesService.Error>>;
}

export const ListLocalFilesService = createAbstraction<IListLocalFilesService>(
  "Files/ListLocalFilesService",
);

export namespace ListLocalFilesService {
  export type Interface = IListLocalFilesService;
  export type Input = IListLocalFilesServiceInput;
  export type Output = IListLocalFilesServiceOutput;
  export type Error = ProjectPersistenceError;
  export type LocalFileWithStatus = ILocalFileWithStatus;
  export type LocalFileProjectStatus = ILocalFileProjectStatus;
}
