import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";
import type { ProjectPersistenceError, TenantNotFoundError } from "~/shared/errors.js";

export interface IUpdateProjectTenantRepositoryInput {
  environmentId: string;
  tenantId: string;
  /** Plaintext; encrypted before it is stored. Null removes the tenant's own token. */
  apiToken: string | null;
}

export interface IUpdateProjectTenantRepository {
  execute(
    input: UpdateProjectTenantRepository.Input,
  ): Promise<Result<ProjectTenant, UpdateProjectTenantRepository.Error>>;
}

export const UpdateProjectTenantRepository = createAbstraction<IUpdateProjectTenantRepository>(
  "Tenants/UpdateProjectTenantRepository",
);

export namespace UpdateProjectTenantRepository {
  export type Interface = IUpdateProjectTenantRepository;
  export type Input = IUpdateProjectTenantRepositoryInput;
  export type Error = TenantNotFoundError | ProjectPersistenceError;
}
