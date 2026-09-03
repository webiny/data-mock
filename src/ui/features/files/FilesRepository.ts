import { makeAutoObservable } from "mobx";
import type { ProjectFile } from "~/shared/types.js";
import { FilesRepository as Abstraction } from "./abstractions/FilesRepository.js";

class FilesRepositoryImpl implements Abstraction.Interface {
  private _files: ProjectFile[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get files(): ProjectFile[] {
    return this._files;
  }

  public setFiles = (files: ProjectFile[]): void => {
    this._files = files;
  };

  public addFile = (file: ProjectFile): void => {
    this._files.push(file);
  };

  public removeFile = (id: string): void => {
    this._files = this._files.filter((f) => f.id !== id);
  };

  public getFilesByProjectId = (projectId: string): ProjectFile[] => {
    return this._files.filter((f) => f.projectId === projectId);
  };
}

export const FilesRepository = Abstraction.createImplementation({
  implementation: FilesRepositoryImpl,
  dependencies: [],
});
