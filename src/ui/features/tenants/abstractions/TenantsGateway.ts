import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITenantSyncResult {
  synced: number;
  tenants: Array<{ tenantId: string; name: string }>;
}

export interface ITenantsGateway {
  listForProject(projectId: string): Promise<Result<ProjectTenant[], HTTPError>>;
  syncForProject(projectId: string): Promise<Result<ITenantSyncResult, HTTPError>>;
}

export const TenantsGateway = createAbstraction<ITenantsGateway>("Ui/TenantsGateway");

export namespace TenantsGateway {
  export type Interface = ITenantsGateway;
  export type SyncResult = ITenantSyncResult;
}
