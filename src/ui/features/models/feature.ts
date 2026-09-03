import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { ModelsGateway } from "./ModelsGateway.js";
import { ModelsRepository } from "./ModelsRepository.js";

export const ModelsFeature = createFeature({
  name: "Ui/ModelsFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(ModelsGateway).inSingletonScope();
    container.register(ModelsRepository).inSingletonScope();
  },
});
