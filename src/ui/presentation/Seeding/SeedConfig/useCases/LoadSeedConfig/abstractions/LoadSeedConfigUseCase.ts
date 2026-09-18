import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel, ProjectTenant } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ILoadSeedConfigOutput {
  projectName: string;
  tenants: ProjectTenant[];
  models: ProjectModel[];
}

export interface ILoadSeedConfigUseCase {
  execute(ref: EnvironmentRef): Promise<Result<ILoadSeedConfigOutput, HTTPError>>;
}

export const LoadSeedConfigUseCase = createAbstraction<ILoadSeedConfigUseCase>(
  "Ui/LoadSeedConfigUseCase",
);

export namespace LoadSeedConfigUseCase {
  export type Interface = ILoadSeedConfigUseCase;
  export type Output = ILoadSeedConfigOutput;
}
