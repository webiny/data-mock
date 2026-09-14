import { Result } from "@webiny/stdlib";
import type { DeletionImpact, Job, ProjectEnvironment, ProjectStack } from "~/shared/types.js";
import {
  listProjectEnvironmentsRoute,
  listEnvironmentStacksRoute,
  syncProjectRoute,
  archiveProjectEnvironmentRoute,
  restoreProjectEnvironmentRoute,
  purgeProjectEnvironmentRoute,
  environmentDeletionImpactRoute,
} from "~/shared/routes/environments.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { EnvironmentsGateway as Abstraction } from "./abstractions/EnvironmentsGateway.js";

class EnvironmentsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async listForProject(
    projectId: string,
    includeArchived?: boolean,
  ): Promise<Result<ProjectEnvironment[], HTTPError>> {
    const result = await this.httpClient.request(listProjectEnvironmentsRoute, {
      params: { projectId },
      query: includeArchived === true ? { includeArchived: "true" } : undefined,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.environments.items);
  }

  public async listStacks(
    projectId: string,
    environmentId: string,
  ): Promise<Result<ProjectStack[], HTTPError>> {
    const result = await this.httpClient.request(listEnvironmentStacksRoute, {
      params: { projectId, environmentId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.stacks.items);
  }

  public async sync(projectId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(syncProjectRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async archive(
    projectId: string,
    environmentId: string,
  ): Promise<Result<ProjectEnvironment, HTTPError>> {
    const result = await this.httpClient.request(archiveProjectEnvironmentRoute, {
      params: { projectId, environmentId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.environment);
  }

  public async restore(
    projectId: string,
    environmentId: string,
  ): Promise<Result<ProjectEnvironment, HTTPError>> {
    const result = await this.httpClient.request(restoreProjectEnvironmentRoute, {
      params: { projectId, environmentId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.environment);
  }

  public async purge(projectId: string, environmentId: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(purgeProjectEnvironmentRoute, {
      params: { projectId, environmentId },
    });
  }

  public async deletionImpact(
    projectId: string,
    environmentId: string,
  ): Promise<Result<DeletionImpact, HTTPError>> {
    const result = await this.httpClient.request(environmentDeletionImpactRoute, {
      params: { projectId, environmentId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.impact);
  }
}

export const EnvironmentsGateway = Abstraction.createImplementation({
  implementation: EnvironmentsGatewayImpl,
  dependencies: [HTTPClient],
});
