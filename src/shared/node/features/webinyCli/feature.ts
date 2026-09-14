import { createFeature } from "@webiny/stdlib";
import { WebinyProjectDetector } from "./detect/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "./checkpoint/PulumiCheckpointReader.js";

export const WebinyCliFeature = createFeature({
  name: "Shared/WebinyCliFeature",
  register(container) {
    container.register(WebinyProjectDetector).inSingletonScope();
    container.register(PulumiCheckpointReader).inSingletonScope();
  },
});
