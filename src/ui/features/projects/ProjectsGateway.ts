import { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import {
  listProjectsRoute,
  getProjectRoute,
  createProjectRoute,
  removeProjectRoute,
} from "~/shared/routes/projects.js";
import { HTTPClient, HTTPError } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { ProjectsGateway as Abstraction } from "./abstractions/ProjectsGateway.js";

class ProjectsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(): Promise<Result<Project[], HTTPError>> {
    const result = await this.httpClient.request(listProjectsRoute, {
      params: {},
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const response = result.value as { projects: { items: Project[]; total: number } };
    return Result.ok(response.projects.items);
  }

  public async getById(id: string): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(getProjectRoute, {
      params: { id },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const response = result.value as { project: Project };
    return Result.ok(response.project);
  }

  public async create(input: Abstraction.CreateInput): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(createProjectRoute, {
      params: {},
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    const response = result.value as { project: Project };
    return Result.ok(response.project);
  }

  public async remove(id: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(removeProjectRoute, {
      params: { id },
    });
  }
}

export const ProjectsGateway = Abstraction.createImplementation({
  implementation: ProjectsGatewayImpl,
  dependencies: [HTTPClient],
});
