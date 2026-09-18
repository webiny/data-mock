import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel, Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import type { EnvironmentRef } from "~/shared/types.js";

export interface IModelsGateway {
  listModels(ref: EnvironmentRef): Promise<Result<ProjectModel[], HTTPError>>;
  pullModels(ref: EnvironmentRef): Promise<Result<Job, HTTPError>>;
}

export const ModelsGateway = createAbstraction<IModelsGateway>("Ui/ModelsGateway");

export namespace ModelsGateway {
  export type Interface = IModelsGateway;
}
