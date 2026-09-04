import { createFeature } from "@webiny/stdlib";
import { AddProjectCommand } from "./AddProjectCommand.js";

export const AddProjectFeature = createFeature({
  name: "Cli/AddProjectFeature",
  register(container) {
    container.register(AddProjectCommand).inSingletonScope();
  },
});
