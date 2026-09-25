import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant, Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import type { EnvironmentRef } from "~/shared/types.js";

export interface ITenantsGateway {
  listForProject(ref: EnvironmentRef): Promise<Result<ProjectTenant[], HTTPError>>;
  syncForProject(ref: EnvironmentRef): Promise<Result<Job, HTTPError>>;
  /** Null removes the tenant's own token. */
  updateToken(
    ref: EnvironmentRef,
    tenantId: string,
    apiToken: string | null,
  ): Promise<Result<ProjectTenant, HTTPError>>;
}

export const TenantsGateway = createAbstraction<ITenantsGateway>("Ui/TenantsGateway");

export namespace TenantsGateway {
  export type Interface = ITenantsGateway;
}
