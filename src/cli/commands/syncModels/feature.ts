import { createFeature } from "@webiny/stdlib";
import { SyncModelsCommand } from "./SyncModelsCommand.js";

export const SyncModelsFeature = createFeature({
  name: "Cli/SyncModelsFeature",
  register(container) {
    container.register(SyncModelsCommand).inSingletonScope();
  },
});
