import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectTenant, Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ITenantsGateway {
  listForProject(projectId: string): Promise<Result<ProjectTenant[], HTTPError>>;
  syncForProject(projectId: string): Promise<Result<Job, HTTPError>>;
}

export const TenantsGateway = createAbstraction<ITenantsGateway>("Ui/TenantsGateway");

export namespace TenantsGateway {
  export type Interface = ITenantsGateway;
}
