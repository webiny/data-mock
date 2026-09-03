import { createFeature } from "~/ui/di/createFeature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { SeedHistoryPresenter } from "./SeedHistoryPresenter.js";
import { LoadSeedHistoryUseCase } from "./useCases/LoadSeedHistory/LoadSeedHistoryUseCase.js";
import { SeedHistoryPresenter as Abstraction } from "./abstractions/SeedHistoryPresenter.js";

interface SeedHistoryExports {
  presenter: Abstraction.Interface;
}

export const SeedHistoryPresentationFeature = createFeature<void, SeedHistoryExports>({
  name: "Ui/SeedHistoryPresentationFeature",
  dependencies: [SeedingFeature],
  register(container) {
    container.register(LoadSeedHistoryUseCase);
    container.register(SeedHistoryPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
