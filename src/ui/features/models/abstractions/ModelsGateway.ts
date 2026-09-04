import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel, Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IModelsGateway {
  listModels(projectId: string): Promise<Result<ProjectModel[], HTTPError>>;
  pullModels(projectId: string): Promise<Result<Job, HTTPError>>;
}

export const ModelsGateway = createAbstraction<IModelsGateway>("Ui/ModelsGateway");

export namespace ModelsGateway {
  export type Interface = IModelsGateway;
}
