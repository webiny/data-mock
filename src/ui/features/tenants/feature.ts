import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { TenantsGateway } from "./TenantsGateway.js";
import { TenantsRepository } from "./TenantsRepository.js";

export const TenantsFeature = createFeature({
  name: "Ui/TenantsFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(TenantsGateway).inSingletonScope();
    container.register(TenantsRepository).inSingletonScope();
  },
});
