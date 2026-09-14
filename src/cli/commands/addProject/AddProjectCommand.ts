import { isCancelled } from "~/cli/abstractions/isCancelled.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { Command } from "~/cli/abstractions/Command.js";

class AddProjectCommandImpl implements Command.Interface {
  public readonly name = "add-project";
  public readonly description = "Add a new Webiny project connection";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly createProjectUseCase: CreateProjectUseCase.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Add Project");

    const name = await this.prompts.text({
      message: "Project name",
      placeholder: "my-webiny-project",
      validate: (value) => (!value || value.trim().length === 0 ? "Name is required" : undefined),
    });
    if (isCancelled(name)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const apiUrl = await this.prompts.text({
      message: "Webiny GraphQL API URL",
      placeholder: "https://your-webiny-api.com",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "URL is required";
        }
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
          return "URL must start with http:// or https://";
        }
        return undefined;
      },
    });
    if (isCancelled(apiUrl)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const apiToken = await this.prompts.text({
      message: "API token",
      placeholder: "your-api-token",
      validate: (value) => (!value || value.trim().length === 0 ? "Token is required" : undefined),
    });
    if (isCancelled(apiToken)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const tenant = await this.prompts.text({
      message: "Default tenant",
      defaultValue: "root",
    });
    if (isCancelled(tenant)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const webinyVersion = await this.prompts.text({
      message: "Webiny version",
      defaultValue: "6.0.0",
      placeholder: "6.4.9",
    });
    if (isCancelled(webinyVersion)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const result = await this.createProjectUseCase.execute({
      name,
      apiUrl,
      apiToken,
      tenant: tenant || "root",
      // Drives the GraphQL operation registry; the prompt still calls it the Webiny version.
      operationsVersion: webinyVersion || "6.0.0",
    });

    if (result.isFail()) {
      this.ui.log.error(`Failed to save project: ${result.error.message}`);
      return;
    }

    this.ui.outro(
      `Project "${result.value.project.name}" added with environment "${result.value.environment.env}".`,
    );
  }
}

export const AddProjectCommand = Command.createImplementation({
  implementation: AddProjectCommandImpl,
  dependencies: [Prompts, UI, CreateProjectUseCase],
});
