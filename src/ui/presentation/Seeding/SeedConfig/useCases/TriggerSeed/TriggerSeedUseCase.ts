import { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { TriggerSeedUseCase as Abstraction } from "./abstractions/TriggerSeedUseCase.js";

class TriggerSeedUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
  ) {}

  public async execute(input: Abstraction.Input): Promise<Result<SeedJob, HTTPError>> {
    const result = await this.seedingGateway.triggerSeed(input.projectId, {
      tenant: input.tenant,
      models: input.models,
    });

    if (result.isOk()) {
      this.seedingRepository.addSeedJob(result.value);
    }

    return result;
  }
}

export const TriggerSeedUseCase = Abstraction.createImplementation({
  implementation: TriggerSeedUseCaseImpl,
  dependencies: [SeedingGateway, SeedingRepository],
});
