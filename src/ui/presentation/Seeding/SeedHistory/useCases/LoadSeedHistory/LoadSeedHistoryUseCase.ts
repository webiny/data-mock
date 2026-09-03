import type { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { LoadSeedHistoryUseCase as Abstraction } from "./abstractions/LoadSeedHistoryUseCase.js";

class LoadSeedHistoryUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
  ) {}

  public async execute(projectId: string): Promise<Result<SeedJob[], HTTPError>> {
    const result = await this.seedingGateway.listSeedJobs(projectId);

    if (result.isOk()) {
      this.seedingRepository.setSeedJobs(result.value);
    }

    return result;
  }
}

export const LoadSeedHistoryUseCase = Abstraction.createImplementation({
  implementation: LoadSeedHistoryUseCaseImpl,
  dependencies: [SeedingGateway, SeedingRepository],
});
