import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project, EnvironmentRef } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IProjectCreateInput {
  name: string;
  /** Absolute path to a Webiny checkout. Omit for a remote-only project. */
  rootPath?: string | undefined;
  operationsVersion?: string | undefined;
  awsProfile?: string | undefined;
  awsRegion?: string | undefined;
  /** Seeds the project's first environment. */
  env?: string | undefined;
  apiUrl?: string | undefined;
  apiToken?: string | undefined;
  tenant?: string | undefined;
}

export interface IProjectUpdateInput {
  name?: string;
  rootPath?: string | null;
  operationsVersion?: string;
  awsProfile?: string | null;
  awsRegion?: string | null;
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
  healthCheck(ref: EnvironmentRef, force?: boolean): Promise<Result<HealthCheckResult, HTTPError>>;
}

export const ProjectsGateway = createAbstraction<IProjectsGateway>("Ui/ProjectsGateway");

export namespace ProjectsGateway {
  export type Interface = IProjectsGateway;
  export type CreateInput = IProjectCreateInput;
  export type UpdateInput = IProjectUpdateInput;
}
