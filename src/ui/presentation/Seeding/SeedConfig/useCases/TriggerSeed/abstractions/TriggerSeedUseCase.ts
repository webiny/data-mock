import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITriggerSeedInput {
  projectId: string;
  tenant: string;
  models: Array<{ modelId: string; amount: number }>;
}

export interface ITriggerSeedUseCase {
  execute(input: ITriggerSeedInput): Promise<Result<SeedJob, HTTPError>>;
}

export const TriggerSeedUseCase = createAbstraction<ITriggerSeedUseCase>("Ui/TriggerSeedUseCase");

export namespace TriggerSeedUseCase {
  export type Interface = ITriggerSeedUseCase;
  export type Input = ITriggerSeedInput;
}
