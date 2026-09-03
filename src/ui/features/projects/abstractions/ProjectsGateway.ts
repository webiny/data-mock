import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IProjectCreateInput {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant?: string;
}

export interface IProjectUpdateInput {
  name?: string;
  apiUrl?: string;
  apiToken?: string;
  tenant?: string;
  webinyVersion?: string;
}

export interface HealthCheckResult {
  reachable: boolean;
  error: string | null;
}

export interface IProjectsGateway {
  list(): Promise<Result<Project[], HTTPError>>;
  getById(id: string): Promise<Result<Project, HTTPError>>;
  create(input: IProjectCreateInput): Promise<Result<Project, HTTPError>>;
  update(id: string, input: IProjectUpdateInput): Promise<Result<Project, HTTPError>>;
  remove(id: string): Promise<Result<void, HTTPError>>;
  healthCheck(id: string): Promise<Result<HealthCheckResult, HTTPError>>;
}

export const ProjectsGateway = createAbstraction<IProjectsGateway>("Ui/ProjectsGateway");

export namespace ProjectsGateway {
  export type Interface = IProjectsGateway;
  export type CreateInput = IProjectCreateInput;
  export type UpdateInput = IProjectUpdateInput;
}
