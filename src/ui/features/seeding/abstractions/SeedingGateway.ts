import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob, Job, Revisions, PublishStrategy } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITriggerSeedModelInput {
  modelId: string;
  amount: number;
  revisions?: Revisions | undefined;
}

export interface ITriggerSeedInput {
  tenant: string;
  models: ITriggerSeedModelInput[];
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
  dryRun?: boolean | undefined;
  batchSize: number;
}

export interface ISeedingGateway {
  triggerSeed(projectId: string, input: ITriggerSeedInput): Promise<Result<Job, HTTPError>>;
  listSeedJobs(projectId: string): Promise<Result<SeedJob[], HTTPError>>;
  importEntries(
    projectId: string,
    input: { tenant: string; models: string[] },
  ): Promise<Result<Job, HTTPError>>;
  cleanupEntries(projectId: string, input?: { jobId?: string }): Promise<Result<Job, HTTPError>>;
}

export const SeedingGateway = createAbstraction<ISeedingGateway>("Ui/SeedingGateway");

export namespace SeedingGateway {
  export type Interface = ISeedingGateway;
  export type TriggerInput = ITriggerSeedInput;
}
