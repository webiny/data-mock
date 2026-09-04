import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { TemplatesGateway } from "./TemplatesGateway.js";
import { TemplatesRepository } from "./TemplatesRepository.js";

export const TemplatesFeature = createFeature({
  name: "Ui/TemplatesFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(TemplatesGateway).inSingletonScope();
    container.register(TemplatesRepository).inSingletonScope();
  },
});
