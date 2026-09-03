import { createFeature } from "@webiny/stdlib";
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { RemoveProjectCommandImpl } from "./RemoveProjectCommand.js";

export const RemoveProjectFeature = createFeature({
  name: "Cli/RemoveProjectFeature",
  register(container) {
    const prompts = container.resolve(Prompts);
    const ui = container.resolve(UI);
    const projectRepository = container.resolve(ProjectRepository);
    container.registerInstance(
      Command,
      new RemoveProjectCommandImpl(prompts, ui, projectRepository),
    );
  },
});
