import { isCancel } from "@clack/prompts";
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { PushModelsService } from "~/shared/node/features/models/push/abstractions/PushModelsService.js";

class PushModelsCommandImpl implements Command.Interface {
  public readonly name = "push-models";
  public readonly description = "Push local models and groups to a Webiny project";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly pushModelsService: PushModelsService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Push Models");

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
      message: "Which project to push models to?",
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

    const project = selected as { id: string; name: string };

    const confirmed = await this.prompts.confirm({
      message: `Push local models to "${project.name}"? This will create groups and models on the remote Webiny instance.`,
    });

    if (isCancel(confirmed) || !confirmed) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const spinner = this.ui.spinner();
    spinner.start(`Pushing models to "${project.name}"...`);

    const result = await this.pushModelsService.execute({ projectId: project.id });

    if (result.isFail()) {
      spinner.stop(`Failed: ${result.error.message}`);
      return;
    }

    const { pushed, skipped } = result.value;
    spinner.stop(
      `Pushed ${pushed.groups} group(s) and ${pushed.models} model(s). Skipped ${skipped.groups} group(s) and ${skipped.models} model(s).`,
    );

    this.ui.outro("Done.");
  }
}

export const PushModelsCommand = Command.createImplementation({
  implementation: PushModelsCommandImpl,
  dependencies: [Prompts, UI, ListProjectsUseCase, PushModelsService],
});
