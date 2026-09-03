import { createAbstraction } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";

export interface ITenantsRepository {
  getTenantsByProjectId(projectId: string): ProjectTenant[];
  setTenants(projectId: string, tenants: ProjectTenant[]): void;
}

export const TenantsRepository = createAbstraction<ITenantsRepository>("Ui/TenantsRepository");

export namespace TenantsRepository {
  export type Interface = ITenantsRepository;
}
