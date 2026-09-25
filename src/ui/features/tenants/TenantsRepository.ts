import { makeAutoObservable } from "mobx";
import type { ProjectTenant } from "~/shared/types.js";
import { TenantsRepository as Abstraction } from "./abstractions/TenantsRepository.js";

class TenantsRepositoryImpl implements Abstraction.Interface {
  private _tenantsByEnvironment = new Map<string, ProjectTenant[]>();

  public constructor() {
    makeAutoObservable(this);
  }

  public getTenantsByEnvironmentId(environmentId: string): ProjectTenant[] {
    return this._tenantsByEnvironment.get(environmentId) ?? [];
  }

  public setTenants(environmentId: string, tenants: ProjectTenant[]): void {
    this._tenantsByEnvironment.set(environmentId, tenants);
  }

  public updateTenant(tenant: ProjectTenant): void {
    const tenants = this._tenantsByEnvironment.get(tenant.environmentId) ?? [];
    this._tenantsByEnvironment.set(
      tenant.environmentId,
      tenants.map((existing) => (existing.tenantId === tenant.tenantId ? tenant : existing)),
    );
  }
}

export const TenantsRepository = Abstraction.createImplementation({
  implementation: TenantsRepositoryImpl,
  dependencies: [],
});
