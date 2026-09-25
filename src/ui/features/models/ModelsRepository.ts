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

  public getModelsByEnvironmentId(environmentId: string, tenant?: string): ProjectModel[] {
    return this._models.filter(
      (model) =>
        model.environmentId === environmentId && (tenant === undefined || model.tenant === tenant),
    );
  }
}

export const ModelsRepository = Abstraction.createImplementation({
  implementation: ModelsRepositoryImpl,
  dependencies: [],
});
