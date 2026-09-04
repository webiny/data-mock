import { makeAutoObservable } from "mobx";
import type { ProjectModel } from "~/shared/types.js";
import { ModelsRepository as Abstraction } from "./abstractions/ModelsRepository.js";

class ModelsRepositoryImpl implements Abstraction.Interface {
  private _models: ProjectModel[] = [];

  public constructor() {
    makeAutoObservable(this);
  }

  public get models(): ProjectModel[] {
    return this._models;
  }

  public setModels(models: ProjectModel[]): void {
    this._models = models;
  }

  public getModelsByProjectId(projectId: string): ProjectModel[] {
    return this._models.filter((m) => m.projectId === projectId);
  }
}

export const ModelsRepository = Abstraction.createImplementation({
  implementation: ModelsRepositoryImpl,
  dependencies: [],
});
