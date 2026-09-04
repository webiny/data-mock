import { makeAutoObservable } from "mobx";
import { LocalFilesRepository as Abstraction } from "./abstractions/LocalFilesRepository.js";
import type { ILocalFileVM } from "./abstractions/LocalFilesGateway.js";

class LocalFilesRepositoryImpl implements Abstraction.Interface {
  private _files: ILocalFileVM[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get files(): ILocalFileVM[] {
    return this._files;
  }

  public setFiles(files: ILocalFileVM[]): void {
    this._files = files;
  }

  public addFile(file: ILocalFileVM): void {
    this._files = [file, ...this._files.filter((f) => f.fileName !== file.fileName)];
  }

  public removeFile(fileName: string): void {
    this._files = this._files.filter((f) => f.fileName !== fileName);
  }
}

export const LocalFilesRepository = Abstraction.createImplementation({
  implementation: LocalFilesRepositoryImpl,
  dependencies: [],
});
