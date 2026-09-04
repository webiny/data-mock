import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { EntriesGateway } from "./EntriesGateway.js";
import { EntriesRepository } from "./EntriesRepository.js";

export const EntriesFeature = createFeature({
  name: "Ui/EntriesFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(EntriesGateway).inSingletonScope();
    container.register(EntriesRepository).inSingletonScope();
  },
});
