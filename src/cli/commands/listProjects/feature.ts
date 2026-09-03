import { createFeature } from "@webiny/stdlib";
import { Command } from "~/cli/abstractions/Command.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { ListProjectsCommandImpl } from "./ListProjectsCommand.js";

export const ListProjectsFeature = createFeature({
  name: "Cli/ListProjectsFeature",
  register(container) {
    const ui = container.resolve(UI);
    const projectRepository = container.resolve(ProjectRepository);
    container.registerInstance(Command, new ListProjectsCommandImpl(ui, projectRepository));
  },
});
