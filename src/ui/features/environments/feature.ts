import { createFeature } from "@webiny/stdlib";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { EnvironmentsGateway } from "./EnvironmentsGateway.js";
import { EnvironmentsRepository } from "./EnvironmentsRepository.js";

export const EnvironmentsFeature = createFeature({
  name: "Ui/EnvironmentsFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(EnvironmentsGateway).inSingletonScope();
    container.register(EnvironmentsRepository).inSingletonScope();
  },
});
