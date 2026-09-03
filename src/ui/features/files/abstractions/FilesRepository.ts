import { createAbstraction } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";

export interface IFilesRepository {
  readonly files: ProjectFile[];
  setFiles(files: ProjectFile[]): void;
  addFile(file: ProjectFile): void;
  removeFile(id: string): void;
  getFilesByProjectId(projectId: string): ProjectFile[];
}

export const FilesRepository = createAbstraction<IFilesRepository>("Ui/FilesRepository");

export namespace FilesRepository {
  export type Interface = IFilesRepository;
}
