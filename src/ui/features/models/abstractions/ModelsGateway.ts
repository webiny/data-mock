import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel, Job } from "~/shared/types.js";
import type { ModelDiffItem, ModelPushResult } from "~/shared/responses/models.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IModelsGateway {
  listModels(projectId: string): Promise<Result<ProjectModel[], HTTPError>>;
  syncModels(projectId: string): Promise<Result<Job, HTTPError>>;
  pushModels(projectId: string): Promise<Result<ModelPushResult, HTTPError>>;
  diffModels(projectId: string): Promise<Result<ModelDiffItem[], HTTPError>>;
}

export const ModelsGateway = createAbstraction<IModelsGateway>("Ui/ModelsGateway");

export namespace ModelsGateway {
  export type Interface = IModelsGateway;
}
