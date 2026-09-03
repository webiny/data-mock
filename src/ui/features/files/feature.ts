import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { FilesGateway } from "./FilesGateway.js";
import { FilesRepository } from "./FilesRepository.js";

export const FilesFeature = createFeature({
  name: "Ui/FilesFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(FilesGateway).inSingletonScope();
    container.register(FilesRepository).inSingletonScope();
  },
});
