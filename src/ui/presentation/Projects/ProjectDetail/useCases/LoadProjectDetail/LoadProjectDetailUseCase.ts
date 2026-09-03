import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { LoadProjectDetailUseCase as Abstraction } from "./abstractions/LoadProjectDetailUseCase.js";

class LoadProjectDetailUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
  ) {}

  public async execute(input: { projectId: string }): Promise<void> {
    const [projectResult, tenantsResult, modelsResult, jobsResult, templatesResult] =
      await Promise.all([
        this.projectsGateway.getById(input.projectId),
        this.tenantsGateway.listForProject(input.projectId),
        this.modelsGateway.listModels(input.projectId),
        this.seedingGateway.listSeedJobs(input.projectId),
        this.templatesGateway.listForProject(input.projectId),
      ]);

    if (projectResult.isOk()) {
      this.projectsRepository.addProject(projectResult.value);
    }
    if (tenantsResult.isOk()) {
      this.tenantsRepository.setTenants(input.projectId, tenantsResult.value);
    }
    if (modelsResult.isOk()) {
      this.modelsRepository.setModels(modelsResult.value);
    }
    if (jobsResult.isOk()) {
      this.seedingRepository.setSeedJobs(jobsResult.value);
    }
    if (templatesResult.isOk()) {
      this.templatesRepository.setTemplates(templatesResult.value);
    }
  }
}

export const LoadProjectDetailUseCase = Abstraction.createImplementation({
  implementation: LoadProjectDetailUseCaseImpl,
  dependencies: [
    ProjectsGateway,
    TenantsGateway,
    ModelsGateway,
    SeedingGateway,
    TemplatesGateway,
    ProjectsRepository,
    TenantsRepository,
    ModelsRepository,
    SeedingRepository,
    TemplatesRepository,
  ],
});
