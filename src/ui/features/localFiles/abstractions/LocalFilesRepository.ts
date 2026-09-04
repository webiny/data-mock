import { createAbstraction } from "@webiny/stdlib";
import type { ILocalFileVM } from "./LocalFilesGateway.js";

export interface ILocalFilesRepository {
  readonly files: ILocalFileVM[];
  setFiles(files: ILocalFileVM[]): void;
  addFile(file: ILocalFileVM): void;
  removeFile(fileName: string): void;
}

export const LocalFilesRepository =
  createAbstraction<ILocalFilesRepository>("Ui/LocalFilesRepository");

export namespace LocalFilesRepository {
  export type Interface = ILocalFilesRepository;
}
