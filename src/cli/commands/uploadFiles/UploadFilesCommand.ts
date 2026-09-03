import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isCancel } from "@clack/prompts";
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { ListProjectTenantsRepository } from "~/shared/node/features/tenants/list/abstractions/ListProjectTenantsRepository.js";
import { FileUploadService } from "~/shared/node/features/files/upload/abstractions/FileUploadService.js";
import type { Project, ProjectTenant } from "~/shared/types.js";

class UploadFilesCommandImpl implements Command.Interface {
  public readonly name = "upload-files";
  public readonly description = "Upload files to a Webiny project's file manager";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly listProjectsUseCase: ListProjectsUseCase.Interface,
    private readonly listTenantsRepository: ListProjectTenantsRepository.Interface,
    private readonly fileUploadService: FileUploadService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Upload Files");

    const listResult = await this.listProjectsUseCase.execute();
    if (listResult.isFail()) {
      this.ui.log.error(`Failed to load projects: ${listResult.error.message}`);
      return;
    }

    const projects = listResult.value.projects;
    if (projects.length === 0) {
      this.ui.log.info("No projects configured. Run 'yarn cli add-project' first.");
      return;
    }

    const selectedProject = await this.prompts.select<Project>({
      message: "Select project",
      options: projects.map((p) => ({ value: p, label: p.name, hint: p.apiUrl })),
    });
    if (isCancel(selectedProject)) {
      this.ui.cancel("Cancelled.");
      return;
    }
    const project = selectedProject as Project;

    const tenantsResult = await this.listTenantsRepository.execute({ projectId: project.id });
    const tenants = tenantsResult.isOk() ? tenantsResult.value : [];
    const tenantOptions =
      tenants.length > 0
        ? tenants.map((t) => ({ value: t, label: t.name, hint: t.tenantId }))
        : [
            {
              value: { tenantId: project.tenant, name: project.tenant } as ProjectTenant,
              label: project.tenant,
            },
          ];

    const selectedTenant = await this.prompts.select<ProjectTenant>({
      message: "Select tenant",
      options: tenantOptions,
    });
    if (isCancel(selectedTenant)) {
      this.ui.cancel("Cancelled.");
      return;
    }
    const tenant = (selectedTenant as ProjectTenant).tenantId;

    const dirPath = await this.prompts.text({
      message: "Path to directory containing files to upload",
      placeholder: "./files",
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Directory path is required";
        }
        try {
          const stat = statSync(value.trim());
          if (!stat.isDirectory()) {
            return "Path is not a directory";
          }
        } catch {
          return "Directory does not exist";
        }
        return undefined;
      },
    });
    if (isCancel(dirPath)) {
      this.ui.cancel("Cancelled.");
      return;
    }

    const dir = (dirPath as string).trim();
    const files = readdirSync(dir).filter((f) => {
      try {
        return statSync(join(dir, f)).isFile();
      } catch {
        return false;
      }
    });

    if (files.length === 0) {
      this.ui.log.warn("No files found in directory.");
      return;
    }

    this.ui.log.info(`Found ${files.length} file(s) to upload.`);

    const spinner = this.ui.spinner();
    let uploaded = 0;
    let failed = 0;

    spinner.start(`Uploading files...`);

    for (const fileName of files) {
      const filePath = join(dir, fileName);
      spinner.message(`Uploading ${fileName} (${uploaded + failed + 1}/${files.length})...`);

      const result = await this.fileUploadService.execute({
        projectId: project.id,
        tenant,
        filePath,
      });

      if (result.isOk()) {
        uploaded++;
      } else {
        failed++;
        this.ui.log.warn(`Failed to upload "${fileName}": ${result.error.message}`);
      }
    }

    spinner.stop(`Uploaded ${uploaded} file(s), ${failed} failed.`);
    this.ui.outro("Done.");
  }
}

export const UploadFilesCommand = Command.createImplementation({
  implementation: UploadFilesCommandImpl,
  dependencies: [Prompts, UI, ListProjectsUseCase, ListProjectTenantsRepository, FileUploadService],
});
