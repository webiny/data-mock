import { isCancel } from "@clack/prompts";
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";

class SyncModelsCommandImpl implements Command.Interface {
  public readonly name = "sync-models";
  public readonly description = "Sync models and groups from a Webiny project";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly syncModelsService: SyncModelsService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Sync Models");

    const projectsResult = await this.listProjectsUseCase.execute();
    if (projectsResult.isFail()) {
      this.ui.log.error(`Failed to load projects: ${projectsResult.error.message}`);
      return;
    }

    const { projects } = projectsResult.value;
    if (projects.length === 0) {
      this.ui.log.warn("No projects configured. Run 'yarn cli add-project' first.");
      return;
    }

    const selected = await this.prompts.select({
      message: "Which project to sync models from?",
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

    const project = selected as { id: string; name: string; apiUrl: string };
    const spinner = this.ui.spinner();
    spinner.start(`Syncing models from "${project.name}"...`);

    const result = await this.syncModelsService.execute({ projectId: project.id });

    if (result.isFail()) {
      spinner.stop(`Failed: ${result.error.message}`);
      return;
    }

    spinner.stop(
      `Synced ${result.value.groups} group(s) and ${result.value.models} model(s) from "${project.name}".`,
    );

    this.ui.outro("Done.");
  }
}

export const SyncModelsCommand = Command.createImplementation({
  implementation: SyncModelsCommandImpl,
  dependencies: [Prompts, UI, ListProjectsUseCase, SyncModelsService],
});
