import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob, Job, Revisions, PublishStrategy } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import type { EnvironmentRef } from "~/shared/types.js";

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

export interface SeedJobsListParams {
  page?: number;
  limit?: number;
  status?: string;
  sortField?: string;
  sortDir?: string;
}

export interface SeedJobsListResult {
  seedJobs: SeedJob[];
  total: number;
}

export interface ISeedingGateway {
  triggerSeed(ref: EnvironmentRef, input: ITriggerSeedInput): Promise<Result<Job, HTTPError>>;
  listSeedJobs(
    ref: EnvironmentRef,
    params?: SeedJobsListParams,
  ): Promise<Result<SeedJobsListResult, HTTPError>>;
  importEntries(
    ref: EnvironmentRef,
    input: { tenant: string; models: string[] },
  ): Promise<Result<Job, HTTPError>>;
  cleanupEntries(ref: EnvironmentRef, input?: { jobId?: string }): Promise<Result<Job, HTTPError>>;
}

export const SeedingGateway = createAbstraction<ISeedingGateway>("Ui/SeedingGateway");

export namespace SeedingGateway {
  export type Interface = ISeedingGateway;
  export type TriggerInput = ITriggerSeedInput;
}
