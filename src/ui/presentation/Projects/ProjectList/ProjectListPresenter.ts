import { makeAutoObservable, runInAction } from "mobx";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/abstractions/DeleteProjectUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type { ProjectListVM } from "./abstractions/ProjectListPresenter.js";

type HealthStatus = "unknown" | "checking" | "reachable" | "unreachable";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _loaded = false;
  private _syncingProjectIds = new Set<string>();
  private _syncingModelsProjectIds = new Set<string>();
  private _removeProjectId: string | null = null;
  private _removeProjectName: string | null = null;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly deleteProjectUseCase: DeleteProjectUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly environmentsRepository: EnvironmentsRepository.Interface,
    private readonly notificationService: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const projects = this.projectsRepository.projects.map((p) => {
      const environments = this.environmentsRepository.getEnvironmentsByProjectId(p.id);
      return {
        id: p.id,
        name: p.name,
        rootPath: p.rootPath,
        webinyVersion: p.webinyVersion,
        environmentCount: environments.length,
        deployedCount: environments.filter((environment) => environment.deployed).length,
        lastSyncedAt: p.lastSyncedAt,
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
    if (this._isLoading || this._loaded) {
      return;
    }
    this._isLoading = true;
    try {
      await this.loadProjectsUseCase.execute();
      const projects = this.projectsRepository.projects;
      await Promise.all(projects.map((p) => this.loadEnvironments(p.id)));
    } finally {
      runInAction(() => {
        this._isLoading = false;
        this._loaded = true;
      });
    }
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

  /**
   * Syncing is project-scoped: it reads the Pulumi checkpoints on disk and rediscovers this
   * project's environments. Pulling tenants or models needs a specific environment, so those
   * actions live on the project detail page where one is selected.
   */
  public syncProject = async (projectId: string): Promise<void> => {
    this._syncingProjectIds.add(projectId);
    try {
      const result = await this.environmentsGateway.sync(projectId);
      if (result.isOk()) {
        this.notificationService.success("Sync started.");
      } else {
        this.notificationService.error(`Failed to start sync: ${result.error.message}`);
      }
    } finally {
      runInAction(() => {
        this._syncingProjectIds.delete(projectId);
      });
    }
  };

  private loadEnvironments = async (projectId: string): Promise<void> => {
    const result = await this.environmentsGateway.listForProject(projectId);
    if (result.isOk()) {
      this.environmentsRepository.setEnvironments(projectId, result.value);
    }
  };
}

export const ProjectListPresenter = Abstraction.createImplementation({
  implementation: ProjectListPresenterImpl,
  dependencies: [
    LoadProjectsUseCase,
    DeleteProjectUseCase,
    ProjectsGateway,
    ProjectsRepository,
    EnvironmentsGateway,
    EnvironmentsRepository,
    NotificationService,
  ],
});
