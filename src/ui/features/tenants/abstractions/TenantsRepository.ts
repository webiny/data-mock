import { createAbstraction } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";

export interface ITenantsRepository {
  getTenantsByEnvironmentId(environmentId: string): ProjectTenant[];
  setTenants(environmentId: string, tenants: ProjectTenant[]): void;
}

export const TenantsRepository = createAbstraction<ITenantsRepository>("Ui/TenantsRepository");

export namespace TenantsRepository {
  export type Interface = ITenantsRepository;
}
