import { isCancel } from "@clack/prompts";
import type { Prompts } from "~/cli/abstractions/Prompts.js";
import type { UI } from "~/cli/abstractions/UI.js";
import type { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import type { Project } from "~/shared/types.js";
import { RemoveProjectCommand as Abstraction } from "./abstractions/RemoveProjectCommand.js";

class RemoveProjectCommandImpl implements Abstraction.Interface {
  public readonly name = "remove-project";
  public readonly description = "Remove a Webiny project connection";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly projectRepository: ProjectRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Remove Project");

    const listResult = await this.projectRepository.list();
    if (listResult.isFail()) {
      this.ui.log.error(`Failed to load projects: ${listResult.error.message}`);
      return;
    }

    const projects = listResult.value;
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

    const removeResult = await this.projectRepository.remove(project.id);
    if (removeResult.isFail()) {
      this.ui.log.error(`Failed to remove project: ${removeResult.error.message}`);
      return;
    }

    this.ui.outro(`Project "${project.name}" removed.`);
  }
}

export { RemoveProjectCommandImpl };
