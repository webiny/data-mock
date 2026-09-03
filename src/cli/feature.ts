import { createFeature } from "@webiny/stdlib";
import { Command } from "./abstractions/Command.js";
import { Prompts } from "./Prompts.js";
import { UI } from "./UI.js";
import { AddProjectFeature } from "./commands/addProject/feature.js";
import { ListProjectsFeature } from "./commands/listProjects/feature.js";
import { RemoveProjectFeature } from "./commands/removeProject/feature.js";

export const CliFeature = createFeature({
  name: "Cli/CliFeature",
  register(container) {
    container.register(Prompts).inSingletonScope();
    container.register(UI).inSingletonScope();

    AddProjectFeature.register(container);
    ListProjectsFeature.register(container);
    RemoveProjectFeature.register(container);
  },
});

export { Command };
