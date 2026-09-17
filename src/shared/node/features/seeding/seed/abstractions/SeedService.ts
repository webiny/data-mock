import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  EnvironmentNotFoundError,
  EnvironmentNotConnectedError,
  ProjectNotFoundError,
  ProjectPersistenceError,
  SeedingError,
} from "~/shared/errors.js";
import type { Revisions, PublishStrategy } from "~/shared/types.js";

export interface ISeedServiceModelInput {
  modelId: string;
  amount: number;
  revisions?: Revisions | undefined;
}

export interface ISeedServiceInput {
  environmentId: string;
  tenant: string;
  models: ISeedServiceModelInput[];
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
  dryRun?: boolean | undefined;
  batchSize: number;
  signal?: AbortSignal | undefined;
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

export interface ISeedModelError {
  modelId: string;
  message: string;
}

export interface ISeedGeneratedModelEntries {
  modelId: string;
  entries: Record<string, unknown>[];
}

export interface ISeedServiceOutput {
  jobId: string;
  created: number;
  errors: ISeedModelError[];
  /** True when the run stopped because the job was cancelled, rather than because it finished. */
  cancelled: boolean;
  dryRun: boolean;
  generatedEntries?: ISeedGeneratedModelEntries[] | undefined;
}

export interface ISeedService {
  execute(input: SeedService.Input): Promise<Result<SeedService.Output, SeedService.Error>>;
}

export const SeedService = createAbstraction<ISeedService>("Seeding/SeedService");

export namespace SeedService {
  export type Interface = ISeedService;
  export type Input = ISeedServiceInput;
  export type Output = ISeedServiceOutput;
  export type ModelError = ISeedModelError;
  export type GeneratedModelEntries = ISeedGeneratedModelEntries;
  export type Error =
    | EnvironmentNotFoundError
    | EnvironmentNotConnectedError
    | ProjectNotFoundError
    | ProjectPersistenceError
    | SeedingError;
}
