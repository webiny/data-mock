import { Result } from "@webiny/stdlib";
import type { Job, ProjectEnvironment, ProjectStack } from "~/shared/types.js";
import {
  listProjectEnvironmentsRoute,
  listEnvironmentStacksRoute,
  syncProjectRoute,
} from "~/shared/routes/environments.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { EnvironmentsGateway as Abstraction } from "./abstractions/EnvironmentsGateway.js";

class EnvironmentsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async listForProject(
    projectId: string,
  ): Promise<Result<ProjectEnvironment[], HTTPError>> {
    const result = await this.httpClient.request(listProjectEnvironmentsRoute, {
      params: { projectId },
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
}

export const EnvironmentsGateway = Abstraction.createImplementation({
  implementation: EnvironmentsGatewayImpl,
  dependencies: [HTTPClient],
});
