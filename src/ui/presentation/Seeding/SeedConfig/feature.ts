import { createFeature } from "~/ui/di/createFeature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { SeedConfigPresenter } from "./SeedConfigPresenter.js";
import { LoadSeedConfigUseCase } from "./useCases/LoadSeedConfig/LoadSeedConfigUseCase.js";
import { TriggerSeedUseCase } from "./useCases/TriggerSeed/TriggerSeedUseCase.js";
import { SeedConfigPresenter as Abstraction } from "./abstractions/SeedConfigPresenter.js";

interface SeedConfigExports {
  presenter: Abstraction.Interface;
}

export const SeedConfigPresentationFeature = createFeature<void, SeedConfigExports>({
  name: "Ui/SeedConfigPresentationFeature",
  dependencies: [SeedingFeature, TenantsFeature, ModelsFeature],
  register(container) {
    container.register(LoadSeedConfigUseCase);
    container.register(TriggerSeedUseCase);
    container.register(SeedConfigPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
