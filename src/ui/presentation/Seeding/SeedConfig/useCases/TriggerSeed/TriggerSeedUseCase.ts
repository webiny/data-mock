import { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { TriggerSeedUseCase as Abstraction } from "./abstractions/TriggerSeedUseCase.js";

class TriggerSeedUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly seedingGateway: SeedingGateway.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Result<Job, HTTPError>> {
    return this.seedingGateway.triggerSeed(input.projectId, {
      tenant: input.tenant,
      models: input.models,
      publishStrategy: input.publishStrategy,
      publishPercent: input.publishPercent,
      includeUnpublish: input.includeUnpublish,
      dryRun: input.dryRun,
      batchSize: input.batchSize,
    });
  }
}

export const TriggerSeedUseCase = Abstraction.createImplementation({
  implementation: TriggerSeedUseCaseImpl,
  dependencies: [SeedingGateway],
});
