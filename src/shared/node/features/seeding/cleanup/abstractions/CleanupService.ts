import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
  SeedingError,
} from "~/shared/errors.js";

export interface ICleanupServiceInput {
  projectId: string;
  jobId?: string;
}

export interface ICleanupServiceModelResult {
  modelId: string;
  deleted: number;
  errors: number;
}

export interface ICleanupServiceOutput {
  deleted: number;
  errors: number;
  models: ICleanupServiceModelResult[];
}

export interface ICleanupService {
  execute(
    input: CleanupService.Input,
  ): Promise<Result<CleanupService.Output, CleanupService.Error>>;
}

export const CleanupService = createAbstraction<ICleanupService>("Seeding/CleanupService");

export namespace CleanupService {
  export type Interface = ICleanupService;
  export type Input = ICleanupServiceInput;
  export type Output = ICleanupServiceOutput;
  export type ModelResult = ICleanupServiceModelResult;
  export type Error =
    | ProjectNotFoundError
    | ProjectPersistenceError
    | GraphQLRequestError
    | SeedingError;
}
