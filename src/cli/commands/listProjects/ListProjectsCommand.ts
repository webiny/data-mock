import { UI } from "~/cli/abstractions/UI.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { Command } from "~/cli/abstractions/Command.js";

class ListProjectsCommandImpl implements Command.Interface {
  public readonly name = "list-projects";
  public readonly description = "List all configured Webiny projects";

  public constructor(
    private readonly ui: UI.Interface,
    private readonly projectRepository: ProjectRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Projects");

    const result = await this.projectRepository.list();

    if (result.isFail()) {
      this.ui.log.error(`Failed to load projects: ${result.error.message}`);
      return;
    }

    const projects = result.value;

    if (projects.length === 0) {
      this.ui.log.info("No projects configured. Run 'yarn cli add-project' to add one.");
      this.ui.outro("");
      return;
    }

    const lines = projects.map(
      (p) => `  ${p.name.padEnd(25)} ${p.apiUrl.padEnd(45)} tenant: ${p.tenant}`,
    );
    this.ui.note(lines.join("\n"), `${projects.length} project(s)`);
    this.ui.outro("");
  }
}

export const ListProjectsCommand = Command.createImplementation({
  implementation: ListProjectsCommandImpl,
  dependencies: [UI, ProjectRepository],
});
