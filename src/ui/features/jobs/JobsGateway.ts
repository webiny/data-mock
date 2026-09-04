import { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import { listJobsRoute, getJobRoute } from "~/shared/routes/jobs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { JobsGateway as Abstraction } from "./abstractions/JobsGateway.js";

class JobsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(projectId: string): Promise<Result<Job[], HTTPError>> {
    const result = await this.httpClient.request(listJobsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.jobs.items);
  }

  public async get(projectId: string, jobId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(getJobRoute, {
      params: { projectId, jobId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }
}

export const JobsGateway = Abstraction.createImplementation({
  implementation: JobsGatewayImpl,
  dependencies: [HTTPClient],
});
