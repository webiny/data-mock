import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
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
  projectId: string;
  tenant: string;
  models: ISeedServiceModelInput[];
  publishStrategy?: PublishStrategy | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
  dryRun?: boolean | undefined;
  batchSize?: number | undefined;
}

export interface ISeedServiceOutput {
  jobId: string;
  created: number;
  errors: Array<{ modelId: string; message: string }>;
  dryRun: boolean;
  generatedEntries?: Array<{ modelId: string; entries: Record<string, unknown>[] }> | undefined;
}

export interface ISeedService {
  execute(input: SeedService.Input): Promise<Result<SeedService.Output, SeedService.Error>>;
}

export const SeedService = createAbstraction<ISeedService>("Seeding/SeedService");

export namespace SeedService {
  export type Interface = ISeedService;
  export type Input = ISeedServiceInput;
  export type Output = ISeedServiceOutput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError | SeedingError;
}
