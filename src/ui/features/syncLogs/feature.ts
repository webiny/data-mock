import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { SyncLogsGateway } from "./SyncLogsGateway.js";
import { SyncLogsRepository } from "./SyncLogsRepository.js";

export const SyncLogsFeature = createFeature({
  name: "Ui/SyncLogsFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(SyncLogsGateway).inSingletonScope();
    container.register(SyncLogsRepository).inSingletonScope();
  },
});
