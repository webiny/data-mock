import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  EnvironmentNotFoundError,
  EnvironmentNotConnectedError,
  GraphQLRequestError,
  ProjectPersistenceError,
} from "~/shared/errors.js";
import type { OperationLog } from "~/shared/types.js";

export interface ISyncModelsServiceInput {
  environmentId: string;
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

/** One tenant's pull. `error` is set, and the counts are 0, when that tenant failed. */
export interface ISyncModelsTenantResult {
  tenant: string;
  groups: number;
  models: number;
  error: string | null;
}

/**
 * Pulls every tenant that has a key. The totals add up the tenants that succeeded; the service
 * fails only when every tenant did.
 */
export interface ISyncModelsServiceOutput {
  groups: number;
  models: number;
  tenants: ISyncModelsTenantResult[];
  operations: OperationLog[];
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
  export type TenantResult = ISyncModelsTenantResult;
  export type Error =
    | EnvironmentNotFoundError
    | EnvironmentNotConnectedError
    | ProjectNotFoundError
    | GraphQLRequestError
    | ProjectPersistenceError;
}
