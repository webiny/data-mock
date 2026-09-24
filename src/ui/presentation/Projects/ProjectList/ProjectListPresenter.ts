import { makeAutoObservable, runInAction } from "mobx";
import { SyncPreviewState } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/abstractions/LoadProjectsUseCase.js";
import { ArchiveProjectUseCase } from "./useCases/ArchiveProject/abstractions/ArchiveProjectUseCase.js";
import { RestoreProjectUseCase } from "./useCases/RestoreProject/abstractions/RestoreProjectUseCase.js";
import { PurgeProjectUseCase } from "./useCases/PurgeProject/abstractions/PurgeProjectUseCase.js";
import { ProjectListPresenter as Abstraction } from "./abstractions/ProjectListPresenter.js";
import type {
  DeletionImpactLineVM,
  ProjectHealth,
  ProjectItemVM,
  ProjectListVM,
} from "./abstractions/ProjectListPresenter.js";
import type { DeletionImpact, Project, ProjectEnvironment } from "~/shared/types.js";
import { toDeletionImpactLines, totalDeletionImpact } from "~/shared/deletion/impactLines.js";

class ProjectListPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _loaded = false;
  /** Per project: how many of its environments answered, and how many were asked. */
  private readonly _health = new Map<string, { reachable: number; checked: number }>();
  private readonly _checkingHealth = new Set<string>();
  private _deleteProjectId: string | null = null;
  private _deleteProjectName: string | null = null;
  private _deleteMode: "archive" | "purge" = "archive";
  private _deleteProjectSeeded = false;
  private _impact: DeletionImpact | null = null;
  private _isLoadingImpact = false;
  private _loadError: string | null = null;
  private readonly syncPreviewState: SyncPreviewState;

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
    private readonly jobsGateway: JobsGateway.Interface,
  ) {
    this.syncPreviewState = new SyncPreviewState(
      environmentsGateway,
      jobsGateway,
      notificationService,
    );
    makeAutoObservable(this);
  }

  public get vm(): ProjectListVM {
    const all = this.projectsRepository.projects.map((project) => this.toItem(project));
    const projects = all.filter((project) => project.archivedAt === null);
    const archivedProjects = all.filter((project) => project.archivedAt !== null);

    return {
      projects,
      isSyncingAll: this.isReadingDiffFor(null),
      syncableCount: projects.filter((project) => project.syncable).length,
      archivedProjects,
      isLoading: this._isLoading,
      loadError: this._loadError,
      isEmpty: !this._isLoading && all.length === 0,
      deleteConfirmation: {
        isOpen: this._deleteProjectId !== null,
        mode: this._deleteMode,
        projectId: this._deleteProjectId,
        projectName: this._deleteProjectName,
        isLoadingImpact: this._isLoadingImpact,
        impact: this.impactLines,
        impactTotal: this.impactTotal,
        seeded: this._deleteProjectSeeded,
      },
      syncPreview: this.syncPreviewState.vm,
    };
  }

  public load = async (): Promise<void> => {
    if (this._isLoading || this._loaded) {
      return;
    }
    this._isLoading = true;
    this._loadError = null;
    let loadedProjects = false;
    try {
      const result = await this.loadProjectsUseCase.execute();
      if (result.isFail()) {
        /**
         * An empty list and a list that could not be read look identical on screen, and the empty
         * one invites the user to add a project that is probably already there.
         */
        runInAction(() => {
          this._loadError = result.error.message;
        });
        return;
      }
      loadedProjects = true;
      const projects = this.projectsRepository.projects;
      const loaded = await Promise.all(
        projects.map((project) => this.loadEnvironments(project.id)),
      );

      /**
       * Reported once for the whole pass rather than per project: a server that is down fails
       * every one of them, and a toast each would bury the page.
       */
      // Fire and forget: the list renders with "Not checked" and fills in as answers arrive.
      void this.checkAllHealth();

      const failed = loaded.filter((ok) => !ok).length;
      if (failed > 0) {
        this.notificationService.error(
          `Could not load the environments of ${failed} project(s). Their cards are incomplete.`,
        );
      }
    } finally {
      runInAction(() => {
        this._isLoading = false;
        /**
         * Only a load that actually loaded counts. Marking a failed one done blocks every retry
         * for the life of the presenter, and the page sits on an error banner with no way back.
         */
        this._loaded = loadedProjects;
      });
    }
  };

  /**
   * Opens the removal confirmation.
   *
   * An archived project opens straight on the permanent delete: archiving is the reversible step,
   * and it has already been taken. Offering it again asks the user to archive what is archived,
   * and buries the only action left behind a second click.
   */
  public confirmDelete = (projectId: string, projectName: string): void => {
    const project = this.projectsRepository.projects.find(
      (candidate) => candidate.id === projectId,
    );

    this._deleteProjectId = projectId;
    this._deleteProjectName = projectName;
    this._deleteProjectSeeded = project?.seeded === true;
    /**
     * A seeded project can be archived but never deleted, so it opens on the reversible step
     * whatever its state — the permanent delete it would otherwise land on is refused.
     */
    this._deleteMode =
      project === undefined || project.archivedAt === null || project.seeded ? "archive" : "purge";
    this._impact = null;
    void this.loadImpact(projectId);
  };

  public cancelDelete = (): void => {
    this._deleteProjectId = null;
    this._deleteProjectName = null;
    this._deleteProjectSeeded = false;
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

    const result = await this.archiveProjectUseCase.execute(id);
    if (result.isFail()) {
      this.notificationService.error(`Failed to archive project: ${result.error.message}`);
      return;
    }

    this.notificationService.success(`Project "${name}" archived. Its data is kept.`);
  };

  public purge = async (): Promise<void> => {
    const id = this._deleteProjectId;
    const name = this._deleteProjectName;
    if (id === null) {
      return;
    }
    /**
     * The confirmation has to have been moved to "purge" first. This destroys the project and
     * every environment, seed entry, sync log, model and job that cascades from it, so it must not
     * be reachable from the dialog's reversible first step by any route.
     */
    if (this._deleteMode !== "purge") {
      return;
    }
    this.cancelDelete();

    const result = await this.purgeProjectUseCase.execute(id);
    if (result.isFail()) {
      this.notificationService.error(`Failed to delete project: ${result.error.message}`);
      return;
    }

    this.notificationService.success(`Project "${name}" and all of its data were deleted.`);
  };

  public restore = async (projectId: string): Promise<void> => {
    const result = await this.restoreProjectUseCase.execute(projectId);
    if (result.isFail()) {
      this.notificationService.error(`Failed to restore project: ${result.error.message}`);
      return;
    }
    await this.loadEnvironments(projectId);
  };

  /**
   * Opens the diff rather than syncing.
   *
   * Syncing is project-scoped: it reads the Pulumi checkpoints on disk and rediscovers that
   * project's environments, overwriting what is stored with whatever the checkout currently says.
   * Pulling tenants or models needs a specific environment, so those actions live on the project
   * detail page where one is selected.
   */
  public syncProject = (projectId: string): void => {
    void this.syncPreviewState.open([projectId]);
  };

  /** The same diff, over every project with a checkout. */
  public syncAll = (): void => {
    void this.syncPreviewState.open(this.syncableProjects.map((project) => project.id));
  };

  public applySync = async (): Promise<void> => {
    await this.syncPreviewState.apply();
  };

  public closeSyncPreview = (): void => {
    this.syncPreviewState.close();
  };

  /**
   * True only while the diff is being read — not while the user is reading it. A spinner that runs
   * for as long as the dialog is open would suggest the button is still doing something.
   *
   * `null` asks about the "sync all" button, which is busy only for a diff covering more than one
   * project.
   */
  private isReadingDiffFor(projectId: string | null): boolean {
    if (!this.syncPreviewState.vm.isLoading) {
      return false;
    }
    const active = this.syncPreviewState.activeProjectIds;
    return projectId === null ? active.length > 1 : active.includes(projectId);
  }

  private get syncableProjects(): Project[] {
    return this.projectsRepository.projects.filter(
      (project) => project.rootPath !== null && project.archivedAt === null,
    );
  }

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
      seeded: project.seeded,
      syncable: project.rootPath !== null,
      seedable: this.reachableEnvironments(environments).length > 0,
      isSyncing: this.isReadingDiffFor(project.id),
      health: this.healthOf(project.id, environments),
      healthLabel: this.healthLabelOf(project.id, environments),
    };
  };

  /** The environments worth asking: active, and with an API to ask. */
  private reachableEnvironments(environments: ProjectEnvironment[]): ProjectEnvironment[] {
    return environments.filter(
      (environment) => environment.archivedAt === null && environment.apiUrl !== null,
    );
  }

  private healthOf(projectId: string, environments: ProjectEnvironment[]): ProjectHealth {
    if (this.reachableEnvironments(environments).length === 0) {
      return "no-endpoint";
    }
    if (this._checkingHealth.has(projectId)) {
      return "checking";
    }

    const counted = this._health.get(projectId);
    if (counted === undefined || counted.checked === 0) {
      return "unknown";
    }
    if (counted.reachable === counted.checked) {
      return "online";
    }
    return counted.reachable === 0 ? "unreachable" : "partial";
  }

  private healthLabelOf(projectId: string, environments: ProjectEnvironment[]): string {
    const asked = this.reachableEnvironments(environments);
    if (asked.length === 0) {
      return "No API to check — deploy or add an endpoint";
    }
    if (this._checkingHealth.has(projectId)) {
      return "Checking...";
    }

    const counted = this._health.get(projectId);
    if (counted === undefined || counted.checked === 0) {
      return "Not checked";
    }
    if (counted.reachable === counted.checked) {
      return counted.checked === 1 ? "Online" : `Online (${counted.checked} environments)`;
    }
    return `${counted.reachable} of ${counted.checked} environments online`;
  }

  /**
   * Asks every project's environments whether they answer.
   *
   * Per environment, not per project: health is an environment-level fact — one stack can be up
   * while another is torn down — and the badge says how many of them answered.
   */
  private checkAllHealth = async (): Promise<void> => {
    await Promise.all(
      this.projectsRepository.projects
        .filter((project) => project.archivedAt === null)
        // The cached answer is fine on load; only an explicit click asks again.
        .map((project) => this.refreshHealth(project.id, false)),
    );
  };

  /**
   * `force` on purpose: the server caches a health answer for ten minutes, so without it clicking
   * the badge returns the same answer and reads as the click having done nothing.
   */
  public refreshHealth = async (projectId: string, force = true): Promise<void> => {
    const environments = this.reachableEnvironments(
      this.environmentsRepository.getEnvironmentsByProjectId(projectId),
    );

    if (environments.length === 0 || this._checkingHealth.has(projectId)) {
      return;
    }

    runInAction(() => {
      this._checkingHealth.add(projectId);
    });

    try {
      const results = await Promise.all(
        environments.map((environment) =>
          this.projectsGateway.healthCheck({ projectId, environmentId: environment.id }, force),
        ),
      );

      const reachable = results.filter((result) => result.isOk() && result.value.reachable).length;

      runInAction(() => {
        this._health.set(projectId, { reachable, checked: results.length });
      });
    } finally {
      runInAction(() => {
        this._checkingHealth.delete(projectId);
      });
    }
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

  /** Returns whether the read succeeded, so the caller can report the pass as a whole. */
  private loadEnvironments = async (projectId: string): Promise<boolean> => {
    const result = await this.environmentsGateway.listForProject(projectId);
    if (result.isFail()) {
      return false;
    }
    this.environmentsRepository.setEnvironments(projectId, result.value);
    return true;
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
    JobsGateway,
  ],
});
