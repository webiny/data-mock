import { Result } from "@webiny/stdlib";
import type { SeedJob, Job } from "~/shared/types.js";
import { listSeedJobsRoute } from "~/shared/routes/seeding.js";
import { triggerSeedRoute } from "~/shared/routes/seeding.js";
import { importEntriesRoute } from "~/shared/routes/import.js";
import { cleanupEntriesRoute } from "~/shared/routes/cleanup.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway as Abstraction } from "./abstractions/SeedingGateway.js";

class SeedingGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async triggerSeed(
    projectId: string,
    input: Abstraction.TriggerInput,
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(triggerSeedRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async listSeedJobs(projectId: string): Promise<Result<SeedJob[], HTTPError>> {
    const result = await this.httpClient.request(listSeedJobsRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.seedJobs.items);
  }

  public async importEntries(
    projectId: string,
    input: { tenant: string; models: string[] },
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(importEntriesRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.job);
  }

  public async cleanupEntries(
    projectId: string,
    input?: { jobId?: string },
  ): Promise<Result<Job, HTTPError>> {
    const result = await this.httpClient.request(cleanupEntriesRoute, {
      params: { projectId },
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
