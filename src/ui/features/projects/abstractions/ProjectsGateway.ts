import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";

export interface IProjectsGateway {
  list(): Promise<Result<Project[], HTTPError>>;
  getById(id: string): Promise<Result<Project, HTTPError>>;
  create(input: ProjectsGateway.CreateInput): Promise<Result<Project, HTTPError>>;
  remove(id: string): Promise<Result<void, HTTPError>>;
}

export const ProjectsGateway = createAbstraction<IProjectsGateway>("Ui/ProjectsGateway");

export namespace ProjectsGateway {
  export type Interface = IProjectsGateway;
  export type CreateInput = {
    name: string;
    apiUrl: string;
    apiToken: string;
    tenant?: string;
  };
}
