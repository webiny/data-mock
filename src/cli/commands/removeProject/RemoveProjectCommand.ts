import { isCancelled } from "~/cli/abstractions/isCancelled.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";
import { RemoveProjectUseCase } from "~/shared/node/features/projects/remove/abstractions/RemoveProjectUseCase.js";
import { DeletionImpactService } from "~/shared/node/features/deletion/impact/abstractions/DeletionImpactService.js";
import { Command } from "~/cli/abstractions/Command.js";
import type { DeletionImpact, Project } from "~/shared/types.js";

const IMPACT_LABELS: Array<[keyof DeletionImpact, string]> = [
  ["environments", "environments"],
  ["stacks", "stack records"],
  ["tenants", "tenants"],
  ["groups", "model groups"],
  ["models", "models"],
  ["files", "uploaded files"],
  ["seedJobs", "seed jobs"],
  ["seedEntries", "seed entries"],
  ["syncLogs", "sync logs"],
  ["jobs", "job records"],
  ["seedTemplates", "seed templates"],
];

type Action = "archive" | "restore" | "purge";

/**
 * Removing defaults to archiving. A hard delete cascades through every child table, so it is a
 * separate choice and is confirmed against the row counts it would destroy.
 */
class RemoveProjectCommandImpl implements Command.Interface {
  public readonly name = "remove-project";
  public readonly description = "Archive, restore or permanently delete a Webiny project";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly archiveProjectRepository: ArchiveProjectRepository.Interface,
    private readonly removeProjectUseCase: RemoveProjectUseCase.Interface,
    private readonly deletionImpactService: DeletionImpactService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Remove Project");

    const listResult = await this.listProjectsUseCase.execute({ includeArchived: true });
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
      message: "Select project",
      options: projects.map((p) => ({
        value: p,
        label: p.name,
        hint: p.archivedAt !== null ? "archived" : (p.rootPath ?? "remote only"),
      })),
    });

    if (isCancelled(selected)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const project = selected as Project;

    this.reportImpact(await this.readImpact(project.id));

    const action = await this.prompts.select<Action>({
      message: `What should happen to "${project.name}"?`,
      options: this.actionsFor(project),
    });

    if (isCancelled(action)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    await this.apply(project, action as Action);
  }

  private actionsFor(project: Project): Prompts.SelectOption<Action>[] {
    const options: Prompts.SelectOption<Action>[] = [];

    if (project.archivedAt === null) {
      options.push({
        value: "archive",
        label: "Archive",
        hint: "hides the project, keeps all of its data",
      });
    } else {
      options.push({ value: "restore", label: "Restore", hint: "put it back in the list" });
    }

    options.push({
      value: "purge",
      label: "Delete permanently",
      hint: "destroys the project and everything listed above",
    });

    return options;
  }

  private async apply(project: Project, action: Action): Promise<void> {
    if (action === "archive" || action === "restore") {
      const result = await this.archiveProjectRepository.execute({
        id: project.id,
        archived: action === "archive",
      });

      if (result.isFail()) {
        this.ui.log.error(`Failed to ${action} project: ${result.error.message}`);
        return;
      }

      this.ui.outro(
        action === "archive"
          ? `Project "${project.name}" archived. Run remove-project again to restore it.`
          : `Project "${project.name}" restored.`,
      );
      return;
    }

    const confirmed = await this.prompts.confirm({
      message: `Permanently delete "${project.name}" and everything listed above? This cannot be undone.`,
    });

    if (isCancelled(confirmed) || !confirmed) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const removeResult = await this.removeProjectUseCase.execute({ id: project.id });
    if (removeResult.isFail()) {
      this.ui.log.error(`Failed to delete project: ${removeResult.error.message}`);
      return;
    }

    this.ui.outro(`Project "${project.name}" and all of its data were deleted.`);
  }

  private async readImpact(projectId: string): Promise<DeletionImpact | null> {
    const result = await this.deletionImpactService.execute({ scope: "project", id: projectId });
    return result.isOk() ? result.value : null;
  }

  /**
   * A failed count is reported as unknown rather than as "nothing stored" — silence here would
   * read as a licence to delete.
   */
  private reportImpact(impact: DeletionImpact | null): void {
    if (impact === null) {
      this.ui.log.warn("Could not count this project's stored data.");
      return;
    }

    const lines = IMPACT_LABELS.filter(([key]) => impact[key] > 0).map(
      ([key, label]) => `  ${impact[key]} ${label}`,
    );

    if (lines.length === 0) {
      this.ui.log.info("No stored data was found for this project.");
      return;
    }

    this.ui.log.info(`A permanent delete would destroy:\n${lines.join("\n")}`);
  }
}

export const RemoveProjectCommand = Command.createImplementation({
  implementation: RemoveProjectCommandImpl,
  dependencies: [
    Prompts,
    UI,
    ListProjectsUseCase,
    ArchiveProjectRepository,
    RemoveProjectUseCase,
    DeletionImpactService,
  ],
});
