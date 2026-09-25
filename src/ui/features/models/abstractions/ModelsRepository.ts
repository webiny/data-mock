import { createAbstraction } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";

export interface IModelsRepository {
  readonly models: ProjectModel[];
  setModels(models: ProjectModel[]): void;
  /** Models are pulled per tenant. Without `tenant`, every tenant's models. */
  getModelsByEnvironmentId(environmentId: string, tenant?: string): ProjectModel[];
}

export const ModelsRepository = createAbstraction<IModelsRepository>("Ui/ModelsRepository");

export namespace ModelsRepository {
  export type Interface = IModelsRepository;
}
