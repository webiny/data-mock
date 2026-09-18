import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { FileSystemGateway } from "./FileSystemGateway.js";

export const FileSystemFeature = createFeature({
  name: "Ui/FileSystemFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(FileSystemGateway).inSingletonScope();
  },
});
