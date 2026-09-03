import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ISyncTenantInput {
  tenantId: string;
  name: string;
}

export interface ISyncProjectTenantsRepositoryInput {
  projectId: string;
  tenants: ISyncTenantInput[];
}

export interface ISyncProjectTenantsRepository {
  execute(
    input: SyncProjectTenantsRepository.Input,
  ): Promise<Result<ProjectTenant[], SyncProjectTenantsRepository.Error>>;
}

export const SyncProjectTenantsRepository = createAbstraction<ISyncProjectTenantsRepository>(
  "Tenants/SyncProjectTenantsRepository",
);

export namespace SyncProjectTenantsRepository {
  export type Interface = ISyncProjectTenantsRepository;
  export type Input = ISyncProjectTenantsRepositoryInput;
  export type TenantInput = ISyncTenantInput;
  export type Error = ProjectPersistenceError;
}
