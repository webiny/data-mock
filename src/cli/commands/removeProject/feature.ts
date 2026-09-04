import { createFeature } from "@webiny/stdlib";
import { RemoveProjectCommand } from "./RemoveProjectCommand.js";

export const RemoveProjectFeature = createFeature({
  name: "Cli/RemoveProjectFeature",
  register(container) {
    container.register(RemoveProjectCommand).inSingletonScope();
  },
});
