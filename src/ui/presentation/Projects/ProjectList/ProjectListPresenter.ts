import { makeAutoObservable, runInAction } from "mobx";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/abstractions/DeleteProjectUseCase.js";
import { LoadTenantsUseCase } from "./useCases/LoadTenants/abstractions/LoadTenantsUseCase.js";
import { SyncTenantsUseCase } from "./useCases/SyncTenants/abstractions/SyncTenantsUseCase.js";
import { SyncModelsUseCase } from "./useCases/SyncModels/abstractions/SyncModelsUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type { ProjectListVM } from "./abstractions/ProjectListPresenter.js";

type HealthStatus = "unknown" | "checking" | "reachable" | "unreachable";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _syncingProjectIds = new Set<string>();
  private _syncingModelsProjectIds = new Set<string>();
  private _removeProjectId: string | null = null;
  private _removeProjectName: string | null = null;
  private _healthMap = new Map<string, HealthStatus>();

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly deleteProjectUseCase: DeleteProjectUseCase.Interface,
    private readonly loadTenantsUseCase: LoadTenantsUseCase.Interface,
    private readonly syncTenantsUseCase: SyncTenantsUseCase.Interface,
    private readonly syncModelsUseCase: SyncModelsUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly notificationService: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const projects = this.projectsRepository.projects.map((p) => {
      const tenants = this.tenantsRepository.getTenantsByProjectId(p.id);
      return {
        id: p.id,
        name: p.name,
        apiUrl: p.apiUrl,
        tenant: p.tenant,
        webinyVersion: p.webinyVersion,
        tenants: tenants.map((t) => ({ tenantId: t.tenantId, name: t.name })),
        health: this._healthMap.get(p.id) ?? "unknown",
        isSyncing: this._syncingProjectIds.has(p.id),
        isSyncingModels: this._syncingModelsProjectIds.has(p.id),
      };
    });

    return {
      projects,
      isLoading: this._isLoading,
      isEmpty: !this._isLoading && projects.length === 0,
      removeConfirmation: {
        isOpen: this._removeProjectId !== null,
        projectId: this._removeProjectId,
        projectName: this._removeProjectName,
      },
    };
  }

  public load = async (): Promise<void> => {
    this._isLoading = true;
    try {
      await this.loadProjectsUseCase.execute();
      const projects = this.projectsRepository.projects;
      await Promise.all(projects.map((p) => this.loadTenantsUseCase.execute(p.id)));
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
    void this.checkAllHealth();
  };

  private checkAllHealth = async (): Promise<void> => {
    const projects = this.projectsRepository.projects;
    for (const p of projects) {
      void this.checkHealth(p.id);
    }
  };

  public refreshHealth = (projectId: string): void => {
    void this.checkHealth(projectId, true);
  };

  private checkHealth = async (projectId: string, force = false): Promise<void> => {
    if (this._healthMap.get(projectId) === "checking") {
      return;
    }
    runInAction(() => {
      this._healthMap.set(projectId, "checking");
    });
    const result = await this.projectsGateway.healthCheck(projectId, force);
    runInAction(() => {
      if (result.isFail()) {
        this._healthMap.set(projectId, "unreachable");
        return;
      }
      this._healthMap.set(projectId, result.value.reachable ? "reachable" : "unreachable");
    });
  };

  public remove = async (id: string): Promise<void> => {
    await this.deleteProjectUseCase.execute(id);
  };

  public confirmRemove = (projectId: string, projectName: string): void => {
    this._removeProjectId = projectId;
    this._removeProjectName = projectName;
  };

  public cancelRemove = (): void => {
    this._removeProjectId = null;
    this._removeProjectName = null;
  };

  public executeRemove = async (): Promise<void> => {
    const id = this._removeProjectId;
    const name = this._removeProjectName;
    if (!id) {
      return;
    }
    this._removeProjectId = null;
    this._removeProjectName = null;
    await this.deleteProjectUseCase.execute(id);
    this.notificationService.success(`Project "${name}" removed.`);
    await this.load();
  };

  public syncTenants = async (projectId: string): Promise<void> => {
    this._syncingProjectIds.add(projectId);
    try {
      await this.syncTenantsUseCase.execute(projectId);
      this.notificationService.success("Tenants synced successfully.");
    } catch {
      this.notificationService.error("Failed to sync tenants.");
    } finally {
      runInAction(() => {
        this._syncingProjectIds.delete(projectId);
      });
    }
  };

  public syncModels = async (projectId: string): Promise<void> => {
    this._syncingModelsProjectIds.add(projectId);
    try {
      await this.syncModelsUseCase.execute(projectId);
      this.notificationService.success("Models synced successfully.");
    } catch {
      this.notificationService.error("Failed to sync models.");
    } finally {
      runInAction(() => {
        this._syncingModelsProjectIds.delete(projectId);
      });
    }
  };
}

export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [
    LoadProjectsUseCase,
    DeleteProjectUseCase,
    LoadTenantsUseCase,
    SyncTenantsUseCase,
    SyncModelsUseCase,
    ProjectsGateway,
    ProjectsRepository,
    TenantsRepository,
    NotificationService,
  ],
});
