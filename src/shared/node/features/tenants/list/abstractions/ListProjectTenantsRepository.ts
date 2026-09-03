import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectTenantsRepositoryInput {
  projectId: string;
}

export interface IListProjectTenantsRepository {
  execute(
    input: ListProjectTenantsRepository.Input,
  ): Promise<Result<ProjectTenant[], ListProjectTenantsRepository.Error>>;
}

export const ListProjectTenantsRepository = createAbstraction<IListProjectTenantsRepository>(
  "Tenants/ListProjectTenantsRepository",
);

export namespace ListProjectTenantsRepository {
  export type Interface = IListProjectTenantsRepository;
  export type Input = IListProjectTenantsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
