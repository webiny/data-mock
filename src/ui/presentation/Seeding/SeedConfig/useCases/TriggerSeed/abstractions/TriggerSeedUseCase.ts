import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Job, Revisions, PublishStrategy } from "~/shared/types.js";
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
  batchSize: number;
}

export interface ITriggerSeedUseCase {
  execute(input: ITriggerSeedInput): Promise<Result<Job, HTTPError>>;
}

export const TriggerSeedUseCase = createAbstraction<ITriggerSeedUseCase>("Ui/TriggerSeedUseCase");

export namespace TriggerSeedUseCase {
  export type Interface = ITriggerSeedUseCase;
  export type Input = ITriggerSeedInput;
}
