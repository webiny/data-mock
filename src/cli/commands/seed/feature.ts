import { createFeature } from "@webiny/stdlib";
import { SeedCommand } from "./SeedCommand.js";

export const SeedFeature = createFeature({
  name: "Cli/SeedFeature",
  register(container) {
    container.register(SeedCommand).inSingletonScope();
  },
});
