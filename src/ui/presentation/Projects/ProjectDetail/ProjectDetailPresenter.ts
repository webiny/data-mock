import { makeAutoObservable, runInAction } from "mobx";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import type { IProjectDetailVM } from "./abstractions/ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/abstractions/LoadProjectDetailUseCase.js";
import { SyncAllUseCase } from "./useCases/SyncAll/abstractions/SyncAllUseCase.js";
import { DeleteTemplateUseCase } from "./useCases/DeleteTemplate/abstractions/DeleteTemplateUseCase.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { Router } from "~/ui/features/router/abstractions/Router.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";

class ProjectDetailPresenterImpl implements Abstraction.Interface {
  private _projectId: string | null = null;
  private _isLoading = false;
  private _isSyncing = false;
  private _activeTab = "tenants";

  public constructor(
    private readonly loadProjectDetailUseCase: LoadProjectDetailUseCase.Interface,
    private readonly syncAllUseCase: SyncAllUseCase.Interface,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
    private readonly router: Router.Interface,
    private readonly notifications: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): IProjectDetailVM {
    const project = this._projectId
      ? (this.projectsRepository.projects.find((p) => p.id === this._projectId) ?? null)
      : null;

    const tenants = this._projectId
      ? this.tenantsRepository.getTenantsByProjectId(this._projectId)
      : [];

    const models = this._projectId
      ? this.modelsRepository.getModelsByProjectId(this._projectId)
      : [];

    const groupMap = new Map<string, { slug: string; name: string; modelCount: number }>();
    for (const model of models) {
      const existing = groupMap.get(model.groupSlug);
      if (existing) {
        existing.modelCount++;
      } else {
        groupMap.set(model.groupSlug, {
          slug: model.groupSlug,
          name: model.groupSlug,
          modelCount: 1,
        });
      }
    }

    const seedJobs = this._projectId ? this.seedingRepository.seedJobs : [];

    const templates = this._projectId
      ? this.templatesRepository.getTemplatesByProjectId(this._projectId)
      : [];

    return {
      project: project
        ? {
            id: project.id,
            name: project.name,
            apiUrl: project.apiUrl,
            webinyVersion: project.webinyVersion,
            tenant: project.tenant,
            createdAt: project.createdAt,
          }
        : null,
      tenants: tenants.map((t) => ({
        tenantId: t.tenantId,
        name: t.name,
        discoveredAt: t.discoveredAt,
      })),
      groups: Array.from(groupMap.values()),
      models: models.map((m) => ({
        modelId: m.modelId,
        name: m.name,
        groupSlug: m.groupSlug,
        fieldCount: m.fields.length,
        syncedAt: m.syncedAt,
      })),
      seedJobs: seedJobs.map((j) => ({
        id: j.id,
        status: j.status,
        modelCount: j.config.models.length,
        entriesCreated: j.result?.created ?? 0,
        errorCount: j.result?.errors.length ?? 0,
        createdAt: j.createdAt,
      })),
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        config: t.config,
      })),
      isLoading: this._isLoading,
      activeTab: this._activeTab,
      isSyncing: this._isSyncing,
    };
  }

  public load = async (projectId: string): Promise<void> => {
    this._projectId = projectId;
    this._isLoading = true;
    try {
      await this.loadProjectDetailUseCase.execute({ projectId });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  public setTab = (tab: string): void => {
    this._activeTab = tab;
  };

  public syncAll = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._isSyncing = true;
    try {
      await this.syncAllUseCase.execute({ projectId: this._projectId });
      this.notifications.success("Tenants and models synced successfully.");
    } catch {
      this.notifications.error("Failed to sync.");
    } finally {
      runInAction(() => {
        this._isSyncing = false;
      });
    }
  };

  public seedProject = (): void => {
    if (this._projectId) {
      this.router.navigate("seed-config", { projectId: this._projectId });
    }
  };

  public loadTemplate = (templateId: string): void => {
    if (this._projectId) {
      this.router.navigate("seed-config", { projectId: this._projectId, templateId });
    }
  };

  public deleteTemplate = async (templateId: string): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    await this.deleteTemplateUseCase.execute({
      projectId: this._projectId,
      templateId,
    });
    this.notifications.success("Template deleted.");
  };
}

export const ProjectDetailPresenter = Abstraction.createImplementation({
  implementation: ProjectDetailPresenterImpl,
  dependencies: [
    LoadProjectDetailUseCase,
    SyncAllUseCase,
    DeleteTemplateUseCase,
    ProjectsRepository,
    TenantsRepository,
    ModelsRepository,
    SeedingRepository,
    TemplatesRepository,
    Router,
    NotificationService,
  ],
});
