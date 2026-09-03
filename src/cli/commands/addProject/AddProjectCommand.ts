import { isCancel } from "@clack/prompts";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { Command } from "~/cli/abstractions/Command.js";
import { createProjectBodySchema } from "~/shared/responses/projects.js";

class AddProjectCommandImpl implements Command.Interface {
  public readonly name = "add-project";
  public readonly description = "Add a new Webiny project connection";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly projectRepository: ProjectRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Add Project");

    const name = await this.prompts.text({
      message: "Project name",
      placeholder: "my-webiny-project",
      validate: (value) => (!value || value.trim().length === 0 ? "Name is required" : undefined),
    });
    if (isCancel(name)) {
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
    if (isCancel(apiUrl)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const apiToken = await this.prompts.text({
      message: "API token",
      placeholder: "your-api-token",
      validate: (value) => (!value || value.trim().length === 0 ? "Token is required" : undefined),
    });
    if (isCancel(apiToken)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const tenant = await this.prompts.text({
      message: "Default tenant",
      defaultValue: "root",
    });
    if (isCancel(tenant)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const parsed = createProjectBodySchema.safeParse({
      name,
      apiUrl,
      apiToken,
      tenant: (tenant as string) || "root",
    });

    if (!parsed.success) {
      this.ui.log.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    const result = await this.projectRepository.create(parsed.data);

    if (result.isFail()) {
      this.ui.log.error(`Failed to save project: ${result.error.message}`);
      return;
    }

    this.ui.outro(`Project "${result.value.name}" added successfully.`);
  }
}

export const AddProjectCommand = Command.createImplementation({
  implementation: AddProjectCommandImpl,
  dependencies: [Prompts, UI, ProjectRepository],
});
