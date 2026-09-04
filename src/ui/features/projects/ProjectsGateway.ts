import { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import {
  listProjectsRoute,
  getProjectRoute,
  createProjectRoute,
  updateProjectRoute,
  removeProjectRoute,
  healthCheckProjectRoute,
} from "~/shared/routes/projects.js";
import type { HealthCheckResult } from "./abstractions/ProjectsGateway.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
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

    return Result.ok(result.value.projects.items);
  }

  public async getById(id: string): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(getProjectRoute, {
      params: { id },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.project);
  }

  public async create(input: Abstraction.CreateInput): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(createProjectRoute, {
      params: {},
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.project);
  }

  public async update(
    id: string,
    input: Abstraction.UpdateInput,
  ): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(updateProjectRoute, {
      params: { id },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.project);
  }

  public async remove(id: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(removeProjectRoute, {
      params: { id },
    });
  }

  public async healthCheck(
    id: string,
    force?: boolean,
  ): Promise<Result<HealthCheckResult, HTTPError>> {
    const result = await this.httpClient.request(healthCheckProjectRoute, {
      params: { id },
      query: force ? { force: "true" } : undefined,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.health);
  }
}

export const ProjectsGateway = Abstraction.createImplementation({
  implementation: ProjectsGatewayImpl,
  dependencies: [HTTPClient],
});
