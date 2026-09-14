import { makeAutoObservable, runInAction } from "mobx";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { ArchiveProjectUseCase } from "./useCases/ArchiveProject/abstractions/ArchiveProjectUseCase.js";
import { RestoreProjectUseCase } from "./useCases/RestoreProject/abstractions/RestoreProjectUseCase.js";
import { PurgeProjectUseCase } from "./useCases/PurgeProject/abstractions/PurgeProjectUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type {
  DeletionImpactLineVM,
  ProjectItemVM,
  ProjectListVM,
} from "./abstractions/ProjectListPresenter.js";
import type { DeletionImpact, Project } from "~/shared/types.js";
import { toDeletionImpactLines, totalDeletionImpact } from "~/shared/deletion/impactLines.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _loaded = false;
  private _syncingProjectIds = new Set<string>();
  private _isSyncingAll = false;
  private _syncingModelsProjectIds = new Set<string>();
  private _deleteProjectId: string | null = null;
  private _deleteProjectName: string | null = null;
  private _deleteMode: "archive" | "purge" = "archive";
  private _impact: DeletionImpact | null = null;
  private _isLoadingImpact = false;

  public constructor(
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly archiveProjectUseCase: ArchiveProjectUseCase.Interface,
    private readonly restoreProjectUseCase: RestoreProjectUseCase.Interface,
    private readonly purgeProjectUseCase: PurgeProjectUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly environmentsRepository: EnvironmentsRepository.Interface,
    private readonly notificationService: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const all = this.projectsRepository.projects.map((p) => this.toItem(p));
    const projects = all.filter((project) => project.archivedAt === null);
    const archivedProjects = all.filter((project) => project.archivedAt !== null);

    return {
      projects,
      isSyncingAll: this._isSyncingAll,
      syncableCount: projects.filter((project) => project.syncable).length,
      archivedProjects,
      isLoading: this._isLoading,
      isEmpty: !this._isLoading && all.length === 0,
      deleteConfirmation: {
        isOpen: this._deleteProjectId !== null,
        mode: this._deleteMode,
        projectId: this._deleteProjectId,
        projectName: this._deleteProjectName,
        isLoadingImpact: this._isLoadingImpact,
        impact: this.impactLines,
        impactTotal: this.impactTotal,
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

  public confirmDelete = (projectId: string, projectName: string): void => {
    this._deleteProjectId = projectId;
    this._deleteProjectName = projectName;
    this._deleteMode = "archive";
    this._impact = null;
    void this.loadImpact(projectId);
  };

  public cancelDelete = (): void => {
    this._deleteProjectId = null;
    this._deleteProjectName = null;
    this._deleteMode = "archive";
    this._impact = null;
  };

  public requestPurge = (): void => {
    this._deleteMode = "purge";
  };

  public archive = async (): Promise<void> => {
    const id = this._deleteProjectId;
    const name = this._deleteProjectName;
    if (id === null) {
      return;
    }
    this.cancelDelete();
    await this.archiveProjectUseCase.execute(id);
    this.notificationService.success(`Project "${name}" archived. Its data is kept.`);
  };

  public purge = async (): Promise<void> => {
    const id = this._deleteProjectId;
    const name = this._deleteProjectName;
    if (id === null) {
      return;
    }
    this.cancelDelete();
    await this.purgeProjectUseCase.execute(id);
    this.notificationService.success(`Project "${name}" and all of its data were deleted.`);
  };

  public restore = async (projectId: string): Promise<void> => {
    await this.restoreProjectUseCase.execute(projectId);
    await this.loadEnvironments(projectId);
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

  /**
   * Enqueues one sync per project rather than a single batch job: each is scoped to its own
   * project, so one failing checkout cannot take the rest of the run down with it.
   */
  public syncAll = async (): Promise<void> => {
    this._isSyncingAll = true;
    try {
      const syncable = this.projectsRepository.projects.filter(
        (project) => project.rootPath !== null && project.archivedAt === null,
      );

      const results = await Promise.all(
        syncable.map((project) => this.environmentsGateway.sync(project.id)),
      );

      const failed = results.filter((result) => result.isFail()).length;

      if (failed === 0) {
        this.notificationService.success(`Sync started for ${results.length} project(s).`);
      } else {
        this.notificationService.error(
          `Sync started for ${results.length - failed} project(s); ${failed} could not be queued.`,
        );
      }
    } finally {
      runInAction(() => {
        this._isSyncingAll = false;
      });
    }
  };

  private get impactLines(): DeletionImpactLineVM[] {
    return this._impact === null ? [] : toDeletionImpactLines(this._impact);
  }

  private get impactTotal(): number {
    return totalDeletionImpact(this.impactLines);
  }

  private toItem = (project: Project): ProjectItemVM => {
    const environments = this.environmentsRepository.getEnvironmentsByProjectId(project.id);

    return {
      id: project.id,
      name: project.name,
      rootPath: project.rootPath,
      webinyVersion: project.webinyVersion,
      environmentCount: environments.length,
      deployedCount: environments.filter((environment) => environment.deployed).length,
      lastSyncedAt: project.lastSyncedAt,
      archivedAt: project.archivedAt,
      syncable: project.rootPath !== null,
      isSyncing: this._syncingProjectIds.has(project.id),
      isSyncingModels: this._syncingModelsProjectIds.has(project.id),
    };
  };

  private loadImpact = async (projectId: string): Promise<void> => {
    this._isLoadingImpact = true;
    try {
      const result = await this.projectsGateway.deletionImpact(projectId);
      runInAction(() => {
        // A failed count must not become a silent "nothing will be lost": the modal keeps showing
        // the loading state rather than an empty list it cannot vouch for.
        this._impact = result.isOk() ? result.value : null;
      });
    } finally {
      runInAction(() => {
        this._isLoadingImpact = false;
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
    ArchiveProjectUseCase,
    RestoreProjectUseCase,
    PurgeProjectUseCase,
    ProjectsGateway,
    ProjectsRepository,
    EnvironmentsGateway,
    EnvironmentsRepository,
    NotificationService,
  ],
});
