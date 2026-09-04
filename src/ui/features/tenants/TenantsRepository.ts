import { makeAutoObservable } from "mobx";
import type { ProjectTenant } from "~/shared/types.js";
import { TenantsRepository as Abstraction } from "./abstractions/TenantsRepository.js";

class TenantsRepositoryImpl implements Abstraction.Interface {
  private _tenantsByProject = new Map<string, ProjectTenant[]>();

  public constructor() {
    makeAutoObservable(this);
  }

  public getTenantsByProjectId(projectId: string): ProjectTenant[] {
    return this._tenantsByProject.get(projectId) ?? [];
  }

  public setTenants(projectId: string, tenants: ProjectTenant[]): void {
    this._tenantsByProject.set(projectId, tenants);
  }
}

export const TenantsRepository = Abstraction.createImplementation({
  implementation: TenantsRepositoryImpl,
  dependencies: [],
});
