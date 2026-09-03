import { createFeature } from "@webiny/stdlib";
import { CreateSeedJobRepository } from "./create/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "./update/UpdateSeedJobRepository.js";
import { ListSeedJobsRepository } from "./list/ListSeedJobsRepository.js";
import { SeedService } from "./seed/SeedService.js";

export const SeedingFeature = createFeature({
  name: "Shared/SeedingFeature",
  register(container) {
    container.register(CreateSeedJobRepository).inSingletonScope();
    container.register(UpdateSeedJobRepository).inSingletonScope();
    container.register(ListSeedJobsRepository).inSingletonScope();

    container.register(SeedService);
  },
});
