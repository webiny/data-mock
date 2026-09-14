import { Result } from "@webiny/stdlib";
import type { DeletionImpact, Project, EnvironmentRef } from "~/shared/types.js";
import {
  listProjectsRoute,
  getProjectRoute,
  createProjectRoute,
  updateProjectRoute,
  archiveProjectRoute,
  restoreProjectRoute,
  purgeProjectRoute,
  projectDeletionImpactRoute,
} from "~/shared/routes/projects.js";
import { healthCheckEnvironmentRoute } from "~/shared/routes/environments.js";
import type { HealthCheckResult } from "./abstractions/ProjectsGateway.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { ProjectsGateway as Abstraction } from "./abstractions/ProjectsGateway.js";

class ProjectsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(includeArchived?: boolean): Promise<Result<Project[], HTTPError>> {
    const result = await this.httpClient.request(listProjectsRoute, {
      params: {},
      query: includeArchived === true ? { includeArchived: "true" } : undefined,
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

  public async archive(id: string): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(archiveProjectRoute, {
      params: { id },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.project);
  }

  public async restore(id: string): Promise<Result<Project, HTTPError>> {
    const result = await this.httpClient.request(restoreProjectRoute, {
      params: { id },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.project);
  }

  public async purge(id: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(purgeProjectRoute, {
      params: { id },
    });
  }

  public async deletionImpact(id: string): Promise<Result<DeletionImpact, HTTPError>> {
    const result = await this.httpClient.request(projectDeletionImpactRoute, {
      params: { id },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.impact);
  }

  public async healthCheck(
    ref: EnvironmentRef,
    force?: boolean,
  ): Promise<Result<HealthCheckResult, HTTPError>> {
    const result = await this.httpClient.request(healthCheckEnvironmentRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
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
