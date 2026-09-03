import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITriggerSeedInput {
  tenant: string;
  models: Array<{ modelId: string; amount: number }>;
}

export interface ISeedingGateway {
  triggerSeed(projectId: string, input: ITriggerSeedInput): Promise<Result<SeedJob, HTTPError>>;
  listSeedJobs(projectId: string): Promise<Result<SeedJob[], HTTPError>>;
}

export const SeedingGateway = createAbstraction<ISeedingGateway>("Ui/SeedingGateway");

export namespace SeedingGateway {
  export type Interface = ISeedingGateway;
  export type TriggerInput = ITriggerSeedInput;
}
