import { createFeature } from "@webiny/stdlib";
import { CreateSeedJobRepository } from "./create/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "./update/UpdateSeedJobRepository.js";
import { ListSeedJobsRepository } from "./list/ListSeedJobsRepository.js";
import { ModelDependencyResolver } from "./resolve/ModelDependencyResolver.js";
import { SeedService } from "./seed/SeedService.js";
import { CreateSeedEntryRepository } from "./entries/CreateSeedEntryRepository.js";
import { ListSeedEntriesRepository } from "./entries/ListSeedEntriesRepository.js";
import { GetSeedEntryRepository } from "./entries/GetSeedEntryRepository.js";
import { DeleteProjectEntriesRepository } from "./entries/DeleteProjectEntriesRepository.js";

export const SeedingFeature = createFeature({
  name: "Shared/SeedingFeature",
  register(container) {
    container.register(CreateSeedJobRepository).inSingletonScope();
    container.register(UpdateSeedJobRepository).inSingletonScope();
    container.register(ListSeedJobsRepository).inSingletonScope();
    container.register(ModelDependencyResolver).inSingletonScope();
    container.register(CreateSeedEntryRepository).inSingletonScope();
    container.register(ListSeedEntriesRepository).inSingletonScope();
    container.register(GetSeedEntryRepository).inSingletonScope();
    container.register(DeleteProjectEntriesRepository).inSingletonScope();

    container.register(SeedService);
  },
});
