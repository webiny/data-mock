import { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import { getJobRoute, cancelJobRoute } from "~/shared/routes/jobs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { JobsGateway as Abstraction } from "./abstractions/JobsGateway.js";
import type { JobsListParams, JobsListResult } from "./abstractions/JobsGateway.js";

interface JobsListResponse {
  jobs: { items: Job[]; total: number };
}

class JobsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    projectId: string,
    params?: JobsListParams,
  ): Promise<Result<JobsListResult, HTTPError>> {
    const parts: string[] = [];
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;
    parts.push(`page=${page}`, `limit=${limit}`);
    if (params?.sortField) {
      parts.push(`sortField=${params.sortField}`);
    }
    if (params?.sortDir) {
      parts.push(`sortDir=${params.sortDir}`);
    }
    if (params?.type) {
      parts.push(`type=${params.type}`);
    }
    if (params?.status) {
      parts.push(`status=${params.status}`);
    }
    const qs = parts.join("&");

    const result = await this.httpClient.get<JobsListResponse>(
      `/api/projects/${projectId}/jobs?${qs}`,
    );

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({
      jobs: result.value.jobs.items,
      total: result.value.jobs.total,
    });
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

  public async cancel(projectId: string, jobId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(cancelJobRoute, {
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
