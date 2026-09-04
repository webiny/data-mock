import { isCancel } from "@clack/prompts";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { Command } from "~/cli/abstractions/Command.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { ListProjectTenantsRepository } from "~/shared/node/features/tenants/list/abstractions/ListProjectTenantsRepository.js";
import { ListProjectModelsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectModelsRepository.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";
import { ListSeedTemplatesRepository } from "~/shared/node/features/templates/list/abstractions/ListSeedTemplatesRepository.js";
import { CreateSeedTemplateRepository } from "~/shared/node/features/templates/create/abstractions/CreateSeedTemplateRepository.js";
import type { ProjectModel, SeedTemplateConfig } from "~/shared/types.js";

class SeedCommandImpl implements Command.Interface {
  public readonly name = "seed";
  public readonly description = "Seed mock data into a Webiny project";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly listTenantsRepository: ListProjectTenantsRepository.Interface,
    private readonly listModelsRepository: ListProjectModelsRepository.Interface,
    private readonly seedService: SeedService.Interface,
    private readonly listTemplatesRepository: ListSeedTemplatesRepository.Interface,
    private readonly createTemplateRepository: CreateSeedTemplateRepository.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Seed Mock Data");

    const projectsResult = await this.listProjectsUseCase.execute();
    if (projectsResult.isFail()) {
      this.ui.log.error(`Failed to list projects: ${projectsResult.error.message}`);
      return;
    }

    const { projects } = projectsResult.value;
    if (projects.length === 0) {
      this.ui.log.warn("No projects configured. Run 'yarn cli add-project' first.");
      return;
    }

    const selectedProject = await this.prompts.select({
      message: "Select project",
      options: projects.map((p) => ({ value: p, label: `${p.name} (${p.apiUrl})` })),
    });
    if (isCancel(selectedProject)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const tenantsResult = await this.listTenantsRepository.execute({
      projectId: selectedProject.id,
    });
    if (tenantsResult.isFail()) {
      this.ui.log.error(`Failed to list tenants: ${tenantsResult.error.message}`);
      return;
    }

    const tenants = tenantsResult.value;
    if (tenants.length === 0) {
      this.ui.log.warn(
        "No tenants found. Run 'yarn cli sync-tenants' or add-project will auto-sync.",
      );
      return;
    }

    const tenantOptions = [
      { value: "__all__", label: "All tenants" },
      ...tenants.map((t) => ({ value: t.tenantId, label: `${t.name} (${t.tenantId})` })),
    ];
    const selectedTenant = await this.prompts.select({
      message: "Select tenant",
      options: tenantOptions,
    });
    if (isCancel(selectedTenant)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const modelsResult = await this.listModelsRepository.execute({
      projectId: selectedProject.id,
    });
    if (modelsResult.isFail()) {
      this.ui.log.error(`Failed to list models: ${modelsResult.error.message}`);
      return;
    }

    const models = modelsResult.value;
    if (models.length === 0) {
      this.ui.log.warn("No models synced. Run 'yarn cli sync-models' first.");
      return;
    }

    const templateResult = await this.loadTemplateOrManual(
      selectedProject.id,
      selectedTenant,
      models,
    );
    if (!templateResult) {
      return;
    }
    const { modelConfigs, dryRun, templateName: usedTemplateName } = templateResult;
    const tenantsToSeed =
      selectedTenant === "__all__" ? tenants.map((t) => t.tenantId) : [selectedTenant];

    const spinner = this.ui.spinner();

    for (const tenantId of tenantsToSeed) {
      spinner.start(`${dryRun ? "[DRY RUN] " : ""}Seeding tenant "${tenantId}"...`);

      const result = await this.seedService.execute({
        projectId: selectedProject.id,
        tenant: tenantId,
        models: modelConfigs,
        dryRun,
        batchSize: 1,
      });

      if (result.isFail()) {
        spinner.stop(`Failed for tenant "${tenantId}": ${result.error.message}`);
        continue;
      }

      const { created, errors, dryRun: wasDryRun } = result.value;
      const prefix = wasDryRun ? "[DRY RUN] " : "";
      spinner.stop(
        `${prefix}Tenant "${tenantId}": ${created} entries ${wasDryRun ? "generated" : "created"}` +
          (errors.length > 0 ? `, ${errors.length} errors` : ""),
      );

      if (errors.length > 0) {
        for (const err of errors.slice(0, 5)) {
          this.ui.log.warn(`  ${err.modelId}: ${err.message}`);
        }
        if (errors.length > 5) {
          this.ui.log.warn(`  ...and ${errors.length - 5} more errors`);
        }
      }
    }

    this.ui.outro(dryRun ? "Dry run complete." : "Seeding complete.");

    if (!usedTemplateName) {
      const saveTemplate = await this.prompts.confirm({
        message: "Save this configuration as a template?",
      });

      if (!isCancel(saveTemplate) && saveTemplate) {
        const nameInput = await this.prompts.text({
          message: "Template name",
          validate: (v) => (!v || v.trim().length === 0 ? "Name is required" : undefined),
        });

        if (!isCancel(nameInput)) {
          const config: SeedTemplateConfig = {
            tenant: selectedTenant as string,
            models: modelConfigs,
          };
          const saveResult = await this.createTemplateRepository.execute({
            projectId: selectedProject.id,
            name: nameInput,
            config,
          });
          if (saveResult.isOk()) {
            this.ui.log.success(`Template "${nameInput}" saved.`);
          }
        }
      }
    }
  }

  private async loadTemplateOrManual(
    projectId: string,
    selectedTenant: string | symbol,
    models: ProjectModel[],
  ): Promise<{
    modelConfigs: Array<{ modelId: string; amount: number }>;
    dryRun: boolean;
    templateName: string | null;
  } | null> {
    const templatesResult = await this.listTemplatesRepository.execute({ projectId });
    const templates = templatesResult.isOk() ? templatesResult.value : [];

    if (templates.length > 0) {
      const source = await this.prompts.select({
        message: "Configuration source",
        options: [
          { value: "manual" as const, label: "Configure manually" },
          ...templates.map((t) => ({ value: t.id, label: `Template: ${t.name}` })),
        ],
      });

      if (isCancel(source)) {
        this.ui.cancel("Cancelled.");
        return null;
      }

      if (source !== "manual") {
        const template = templates.find((t) => t.id === source);
        if (template) {
          const dryRun = await this.askDryRun();
          if (dryRun === null) {
            return null;
          }
          return { modelConfigs: template.config.models, dryRun, templateName: template.name };
        }
      }
    }

    const selectedModels = await this.prompts.multiselect({
      message: "Select models to seed",
      options: models.map((m) => ({
        value: m,
        label: `${m.name} (${m.modelId})`,
        hint: `${m.fields.length} fields`,
      })),
      required: true,
    });
    if (isCancel(selectedModels)) {
      this.ui.cancel("Cancelled.");
      return null;
    }

    const amountInput = await this.prompts.text({
      message: "Entries per model",
      defaultValue: "10",
      validate: (value) => {
        if (!value) {
          return "Amount is required";
        }
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
          return "Must be a positive number";
        }
        return undefined;
      },
    });
    if (isCancel(amountInput)) {
      this.ui.cancel("Cancelled.");
      return null;
    }

    const amount = parseInt(amountInput, 10);
    const modelConfigs = selectedModels.map((m) => ({ modelId: m.modelId, amount }));

    const dryRun = await this.askDryRun();
    if (dryRun === null) {
      return null;
    }

    return { modelConfigs, dryRun, templateName: null };
  }

  private async askDryRun(): Promise<boolean | null> {
    const dryRunChoice = await this.prompts.confirm({
      message: "Dry run? (generate entries without sending to Webiny)",
      active: "Yes",
      inactive: "No",
    });
    if (isCancel(dryRunChoice)) {
      this.ui.cancel("Cancelled.");
      return null;
    }
    return dryRunChoice === true;
  }
}

export const SeedCommand = Command.createImplementation({
  implementation: SeedCommandImpl,
  dependencies: [
    Prompts,
    UI,
    ListProjectsUseCase,
    ListProjectTenantsRepository,
    ListProjectModelsRepository,
    SeedService,
    ListSeedTemplatesRepository,
    CreateSeedTemplateRepository,
  ],
});
