import { createAbstraction } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";

export interface IModelsRepository {
  readonly models: ProjectModel[];
  setModels(models: ProjectModel[]): void;
  getModelsByEnvironmentId(environmentId: string): ProjectModel[];
}

export const ModelsRepository = createAbstraction<IModelsRepository>("Ui/ModelsRepository");

export namespace ModelsRepository {
  export type Interface = IModelsRepository;
}
