import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { SeedingGateway } from "./SeedingGateway.js";
import { SeedingRepository } from "./SeedingRepository.js";

export const SeedingFeature = createFeature({
  name: "Ui/SeedingFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(SeedingGateway).inSingletonScope();
    container.register(SeedingRepository).inSingletonScope();
  },
});
