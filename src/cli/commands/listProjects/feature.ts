import { createFeature } from "@webiny/stdlib";
import { ListProjectsCommand } from "./ListProjectsCommand.js";

export const ListProjectsFeature = createFeature({
  name: "Cli/ListProjectsFeature",
  register(container) {
    container.register(ListProjectsCommand).inSingletonScope();
  },
});
