import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IModelsGateway {
  listModels(projectId: string): Promise<Result<ProjectModel[], HTTPError>>;
  syncModels(projectId: string): Promise<Result<unknown, HTTPError>>;
}

export const ModelsGateway = createAbstraction<IModelsGateway>("Ui/ModelsGateway");

export namespace ModelsGateway {
  export type Interface = IModelsGateway;
}
