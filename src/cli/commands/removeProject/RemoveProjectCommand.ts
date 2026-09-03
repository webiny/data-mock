import { isCancel } from "@clack/prompts";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { RemoveProjectUseCase } from "~/shared/node/features/projects/remove/abstractions/RemoveProjectUseCase.js";
import { Command } from "~/cli/abstractions/Command.js";
import type { Project } from "~/shared/types.js";

class RemoveProjectCommandImpl implements Command.Interface {
  public readonly name = "remove-project";
  public readonly description = "Remove a Webiny project connection";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly removeProjectUseCase: RemoveProjectUseCase.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Remove Project");

    const listResult = await this.listProjectsUseCase.execute();
    if (listResult.isFail()) {
      this.ui.log.error(`Failed to load projects: ${listResult.error.message}`);
      return;
    }

    const projects = listResult.value.projects;
    if (projects.length === 0) {
      this.ui.log.info("No projects configured.");
      this.ui.outro("");
      return;
    }

    const selected = await this.prompts.select<Project>({
      message: "Select project to remove",
      options: projects.map((p) => ({
        value: p,
        label: p.name,
        hint: p.apiUrl,
      })),
    });

    if (isCancel(selected)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const project = selected as Project;

    const confirmed = await this.prompts.confirm({
      message: `Remove "${project.name}"? This cannot be undone.`,
    });

    if (isCancel(confirmed) || !confirmed) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const removeResult = await this.removeProjectUseCase.execute({ id: project.id });
    if (removeResult.isFail()) {
      this.ui.log.error(`Failed to remove project: ${removeResult.error.message}`);
      return;
    }

    this.ui.outro(`Project "${project.name}" removed.`);
  }
}

export const RemoveProjectCommand = Command.createImplementation({
  implementation: RemoveProjectCommandImpl,
  dependencies: [Prompts, UI, ListProjectsUseCase, RemoveProjectUseCase],
});
