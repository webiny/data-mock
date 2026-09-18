import { Result } from "@webiny/stdlib";
import type { SeedJob, Job } from "~/shared/types.js";
import { resumeSeedRoute, triggerSeedRoute } from "~/shared/routes/seeding.js";
import { importEntriesRoute } from "~/shared/routes/import.js";
import { cleanupEntriesRoute } from "~/shared/routes/cleanup.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway as Abstraction } from "./abstractions/SeedingGateway.js";
import type { SeedJobsListParams, SeedJobsListResult } from "./abstractions/SeedingGateway.js";
import type { EnvironmentRef } from "~/shared/types.js";

class SeedingGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async triggerSeed(
    ref: EnvironmentRef,
    input: Abstraction.TriggerInput,
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(triggerSeedRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async resumeSeed(ref: EnvironmentRef, seedJobId: string): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(resumeSeedRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId, seedJobId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async listSeedJobs(
    ref: EnvironmentRef,
    params?: SeedJobsListParams,
  ): Promise<Result<SeedJobsListResult, HTTPError>> {
    const parts: string[] = [];
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;
    parts.push(`page=${page}`, `limit=${limit}`);
    if (params?.status) {
      parts.push(`status=${params.status}`);
    }
    if (params?.sortField) {
      parts.push(`sortField=${params.sortField}`);
    }
    if (params?.sortDir) {
      parts.push(`sortDir=${params.sortDir}`);
    }
    const qs = parts.join("&");

    const result = await this.httpClient.get<{ seedJobs: { items: SeedJob[]; total: number } }>(
      `/api/projects/${ref.projectId}/environments/${ref.environmentId}/seed-jobs?${qs}`,
    );

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({
      seedJobs: result.value.seedJobs.items,
      total: result.value.seedJobs.total,
    });
  }

  public async importEntries(
    ref: EnvironmentRef,
    input: { tenant: string; models: string[] },
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(importEntriesRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async cleanupEntries(
    ref: EnvironmentRef,
    input?: { jobId?: string },
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(cleanupEntriesRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
      body: input ?? {},
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }
}

export const SeedingGateway = Abstraction.createImplementation({
  implementation: SeedingGatewayImpl,
  dependencies: [HTTPClient],
});
