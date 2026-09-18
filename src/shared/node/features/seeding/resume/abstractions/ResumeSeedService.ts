import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedModelConfig } from "~/shared/types.js";
import type {
  JobNotFoundError,
  ProjectPersistenceError,
  ValidationError,
} from "~/shared/errors.js";

export interface IResumeSeedInput {
  /** The `seed_jobs` row to resume. */
  seedJobId: string;
}

export interface IResumeSeedOutput {
  environmentId: string;
  tenant: string;
  /** Only what the original run did not finish. A model it completed is absent. */
  models: SeedModelConfig[];
  batchSize: number;
  publishStrategy?: string | undefined;
  publishPercent?: number | undefined;
  includeUnpublish?: boolean | undefined;
  /** What the original run created, for the confirmation to show. */
  alreadyCreated: number;
}

export interface IResumeSeedService {
  execute(
    input: ResumeSeedService.Input,
  ): Promise<Result<ResumeSeedService.Output, ResumeSeedService.Error>>;
}

export const ResumeSeedService = createAbstraction<IResumeSeedService>("Seeding/ResumeSeedService");

export namespace ResumeSeedService {
  export type Interface = IResumeSeedService;
  export type Input = IResumeSeedInput;
  export type Output = IResumeSeedOutput;
  export type Error = JobNotFoundError | ProjectPersistenceError | ValidationError;
}
