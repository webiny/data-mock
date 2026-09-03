import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  SeedingError,
} from "~/shared/errors.js";

export interface ISeedServiceInput {
  projectId: string;
  tenant: string;
  models: Array<{ modelId: string; amount: number }>;
}

export interface ISeedServiceOutput {
  jobId: string;
  created: number;
  errors: Array<{ modelId: string; message: string }>;
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
