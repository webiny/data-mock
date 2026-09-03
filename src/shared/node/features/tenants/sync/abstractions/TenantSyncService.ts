import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  GraphQLRequestError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export interface ITenantSyncInput {
  projectId: string;
}

export interface ITenantSyncDiff {
  added: Array<{ tenantId: string; name: string }>;
  removed: Array<{ tenantId: string; name: string }>;
  unchanged: Array<{ tenantId: string; name: string }>;
}

export interface ITenantSyncOutput {
  tenants: Array<{ tenantId: string; name: string }>;
  synced: number;
  diff: ITenantSyncDiff;
}

export interface ITenantSyncService {
  execute(
    input: TenantSyncService.Input,
  ): Promise<Result<TenantSyncService.Output, TenantSyncService.Error>>;
}

export const TenantSyncService = createAbstraction<ITenantSyncService>("Tenants/TenantSyncService");

export namespace TenantSyncService {
  export type Interface = ITenantSyncService;
  export type Input = ITenantSyncInput;
  export type Output = ITenantSyncOutput;
  export type Error = ProjectNotFoundError | GraphQLRequestError | ProjectPersistenceError;
}
