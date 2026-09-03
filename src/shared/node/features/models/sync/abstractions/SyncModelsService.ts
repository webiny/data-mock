import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  GraphQLRequestError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export interface ISyncModelsServiceInput {
  projectId: string;
}

export interface ISyncModelsServiceOutput {
  groups: number;
  models: number;
}

export interface ISyncModelsService {
  execute(
    input: SyncModelsService.Input,
  ): Promise<Result<SyncModelsService.Output, SyncModelsService.Error>>;
}

export const SyncModelsService = createAbstraction<ISyncModelsService>("Models/SyncModelsService");

export namespace SyncModelsService {
  export type Interface = ISyncModelsService;
  export type Input = ISyncModelsServiceInput;
  export type Output = ISyncModelsServiceOutput;
  export type Error = ProjectNotFoundError | GraphQLRequestError | ProjectPersistenceError;
}
