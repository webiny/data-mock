import { createFeature } from "@webiny/stdlib";
import { RotateKeyCommand } from "./RotateKeyCommand.js";

export const RotateKeyFeature = createFeature({
  name: "Cli/RotateKeyFeature",
  register(container) {
    container.register(RotateKeyCommand).inSingletonScope();
  },
});
