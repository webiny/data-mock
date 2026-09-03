import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob, Revisions, PublishStrategy } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITriggerSeedModelInput {
  modelId: string;
  amount: number;
  revisions?: Revisions | undefined;
}

export interface ITriggerSeedInput {
  projectId: string;
  tenant: string;
  models: ITriggerSeedModelInput[];
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
  dryRun?: boolean | undefined;
}

export interface ITriggerSeedUseCase {
  execute(input: ITriggerSeedInput): Promise<Result<SeedJob, HTTPError>>;
}

export const TriggerSeedUseCase = createAbstraction<ITriggerSeedUseCase>("Ui/TriggerSeedUseCase");

export namespace TriggerSeedUseCase {
  export type Interface = ITriggerSeedUseCase;
  export type Input = ITriggerSeedInput;
}
