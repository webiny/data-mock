import { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import {
  listJobsRoute,
  listGlobalJobsRoute,
  getGlobalJobRoute,
  getJobRoute,
  cancelGlobalJobRoute,
  cancelJobRoute,
} from "~/shared/routes/jobs.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { JobsGateway as Abstraction } from "./abstractions/JobsGateway.js";
import type { JobsListParams, JobsListResult } from "./abstractions/JobsGateway.js";

class JobsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    projectId: string,
    params?: JobsListParams,
  ): Promise<Result<JobsListResult, HTTPError>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;

    const result = await this.httpClient.request(listJobsRoute, {
      params: { projectId },
      query: {
        page: String(page),
        limit: String(limit),
        ...(params?.sortField ? { sortField: params.sortField } : {}),
        ...(params?.sortDir ? { sortDir: params.sortDir } : {}),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    });

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

  /** Every job, including the ones that belong to no project. */
  public async listAll(params?: JobsListParams): Promise<Result<JobsListResult, HTTPError>> {
    const result = await this.httpClient.request(listGlobalJobsRoute, {
      params: {},
      query: {
        page: String(params?.page ?? 1),
        limit: String(params?.limit ?? 25),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({ jobs: result.value.jobs.items, total: result.value.jobs.total });
  }

  public async getGlobal(jobId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(getGlobalJobRoute, {
      params: { jobId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async cancelGlobal(jobId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(cancelGlobalJobRoute, {
      params: { jobId },
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
