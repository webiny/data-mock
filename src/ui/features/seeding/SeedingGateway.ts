import { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import { triggerSeedRoute, listSeedJobsRoute } from "~/shared/routes/seeding.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway as Abstraction } from "./abstractions/SeedingGateway.js";

class SeedingGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async triggerSeed(
    projectId: string,
    input: Abstraction.TriggerInput,
  ): Promise<Result<SeedJob, HTTPError>> {
    const result = await this.httpClient.request(triggerSeedRoute, {
      params: { projectId },
      body: input,
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.seedJob);
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
}

export const SeedingGateway = Abstraction.createImplementation({
  implementation: SeedingGatewayImpl,
  dependencies: [HTTPClient],
});
