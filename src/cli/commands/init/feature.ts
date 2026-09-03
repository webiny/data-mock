import { createFeature } from "@webiny/stdlib";
import { InitCommand } from "./InitCommand.js";

export const InitFeature = createFeature({
  name: "Cli/InitFeature",
  register(container) {
    container.register(InitCommand).inSingletonScope();
  },
});
