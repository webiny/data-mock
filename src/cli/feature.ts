import { createFeature } from "@webiny/stdlib";
import { ProjectRepositoryFeature } from "~/shared/features/ProjectRepositoryFeature.js";
import { Prompts } from "./abstractions/Prompts.js";
import { UI } from "./abstractions/UI.js";
import { Command } from "./abstractions/Command.js";
import { PromptsImpl } from "./Prompts.js";
import { UIImpl } from "./UI.js";
import { AddProjectFeature } from "./commands/addProject/feature.js";
import { ListProjectsFeature } from "./commands/listProjects/feature.js";
import { RemoveProjectFeature } from "./commands/removeProject/feature.js";

export const CliFeature = createFeature({
  name: "Cli/CliFeature",
  register(container) {
    container.registerInstance(Prompts, new PromptsImpl());
    container.registerInstance(UI, new UIImpl());

    ProjectRepositoryFeature.register(container);

    AddProjectFeature.register(container);
    ListProjectsFeature.register(container);
    RemoveProjectFeature.register(container);
  },
});

export { Command };
