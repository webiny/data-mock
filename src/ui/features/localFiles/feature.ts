import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { LocalFilesGateway } from "./LocalFilesGateway.js";
import { LocalFilesRepository } from "./LocalFilesRepository.js";

export const LocalFilesFeature = createFeature({
  name: "Ui/LocalFilesFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(LocalFilesGateway).inSingletonScope();
    container.register(LocalFilesRepository).inSingletonScope();
  },
});
