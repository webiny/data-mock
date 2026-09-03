import { createFeature } from "@webiny/stdlib";
import { PushModelsCommand } from "./PushModelsCommand.js";

export const PushModelsFeature = createFeature({
  name: "Cli/PushModelsFeature",
  register(container) {
    container.register(PushModelsCommand).inSingletonScope();
  },
});
