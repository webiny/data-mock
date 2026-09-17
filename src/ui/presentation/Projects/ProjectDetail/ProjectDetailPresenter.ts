import { makeAutoObservable, runInAction } from "mobx";
import { SyncPreviewState } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import type {
  IDeploymentDialogVM,
  IEnvironmentVM,
  IProjectDetailVM,
  IEditProjectInput,
  IStackVM,
} from "./abstractions/ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/abstractions/LoadProjectDetailUseCase.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import type {
  DeletionImpact,
  EnvironmentRef,
  ProjectEnvironment,
  ProjectStack,
} from "~/shared/types.js";
import { toDeletionImpactLines, totalDeletionImpact } from "~/shared/deletion/impactLines.js";
import { buildSystemInfo, namedResourcesAtRisk, systemInfoNotice } from "./systemInfo.js";
import { getStackName } from "~/shared/environments/index.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { WEBINY_REGIONS } from "~/shared/webiny/regions.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";

const STACK_STATE_LABELS: Record<string, string> = {
  deployed: "Deployed",
  "not-deployed": "Not deployed",
  unknown: "Could not read",
};

function toStackVM(stack: ProjectStack): IStackVM {
  return {
    app: stack.app,
    deployed: stack.deployed,
    // An unreadable stack has no count. Showing 0 would claim it is empty.
    resourceCount: stack.readState === "unknown" ? null : stack.resourceCount,
    readState: stack.readState,
    stateLabel: STACK_STATE_LABELS[stack.readState] ?? stack.readState,
    syncedAt: stack.syncedAt,
    rawOutput: stack.stackOutput === null ? null : JSON.stringify(stack.stackOutput, null, 2),
  };
}

function toEnvironmentVM(environment: ProjectEnvironment): IEnvironmentVM {
  return {
    archivedAt: environment.archivedAt,
    id: environment.id,
    stackName: getStackName({ env: environment.env, variant: environment.variant }),
    env: environment.env,
    variant: environment.variant,
    region: environment.region,
    deployed: environment.deployed,
    // Seeding needs an API to talk to; a core-only deployment has none.
    connectable: environment.apiUrl !== null,
    apiUrl: environment.apiUrl,
    adminUrl: environment.adminUrl,
    tenant: environment.tenant,
    lastSyncedAt: environment.lastSyncedAt,
  };
}

class ProjectDetailPresenterImpl implements Abstraction.Interface {
  private _projectId: string | null = null;
  private _environmentId: string | null = null;
  /** Stack name from the URL (`dev`, `dev___blue`), or null to take the project's first. */
  private _envName: string | null = null;
  private _environmentError: string | null = null;
  private _loadError: string | null = null;
  private _isLoading = false;
  private _isSyncing = false;
  private _removeEnvironmentId: string | null = null;
  private _removeEnvironmentStackName: string | null = null;
  private _removeEnvironmentMode: "archive" | "purge" = "archive";
  private _environmentImpact: DeletionImpact | null = null;
  private _isLoadingEnvironmentImpact = false;
  private _deploymentCommand: "deploy" | "destroy" | null = null;
  private _deploymentStep: "review" | "confirm" = "review";
  private _deployableApps: string[] = [];
  private _selectedApps: string[] = [];
  private _deploymentRegion: string | null = null;
  private _deploymentTypedName = "";
  private _deploymentPreview = false;
  private _isSubmittingDeployment = false;
  private _deploymentError: string | null = null;
  private _showEditDialog = false;
  private _loadingProjectId: string | null = null;
  /**
   * The project and stack name that actually loaded, as one key. Separate from `_projectId` and
   * `_envName`, which are set before the read so the error state has something to render.
   */
  private _loadedKey: string | null = null;
  private _projectHealth: "unknown" | "checking" | "reachable" | "unreachable" = "unknown";
  private _projectHealthError: string | null = null;
  /** The environment whose stacks are stored, so they are read once per environment. */
  private _stacksLoadedFor: string | null = null;
  private _isLoadingStacks = false;
  private readonly disposeJobSubscription: () => void;
  private readonly syncPreviewState: SyncPreviewState;

  public constructor(
    private readonly loadProjectDetailUseCase: LoadProjectDetailUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly environmentsRepository: EnvironmentsRepository.Interface,
    private readonly jobsGateway: JobsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    this.syncPreviewState = new SyncPreviewState(environmentsGateway, jobsGateway, notifications);
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IProjectDetailVM {
    const environmentId = this._environmentId;
    const project = this._projectId
      ? (this.projectsRepository.projects.find((candidate) => candidate.id === this._projectId) ??
        null)
      : null;
    const allEnvironmentVMs = (
      this._projectId ? this.environmentsRepository.getEnvironmentsByProjectId(this._projectId) : []
    ).map((environment) => toEnvironmentVM(environment));
    // The selector and every environment-scoped action see only the active ones; the Environments
    // tab reads `archivedEnvironments` to offer Restore.
    const environmentVMs = allEnvironmentVMs.filter(
      (environment) => environment.archivedAt === null,
    );
    const archivedEnvironmentVMs = allEnvironmentVMs.filter(
      (environment) => environment.archivedAt !== null,
    );
    const currentEnvironmentVM =
      environmentVMs.find((environment) => environment.id === environmentId) ?? null;

    const stackRows = environmentId ? this.environmentsRepository.getStacks(environmentId) : [];

    return {
      project: project
        ? {
            id: project.id,
            name: project.name,
            rootPath: project.rootPath,
            webinyVersion: project.webinyVersion,
            versionMajor: project.versionMajor,
            operationsVersion: project.operationsVersion,
            createdAt: project.createdAt,
          }
        : null,
      environments: environmentVMs,
      archivedEnvironments: archivedEnvironmentVMs,
      currentEnvironment: currentEnvironmentVM,
      stacks: stackRows.map(toStackVM),
      environmentDeleteConfirmation: {
        isOpen: this._removeEnvironmentId !== null,
        mode: this._removeEnvironmentMode,
        environmentId: this._removeEnvironmentId,
        stackName: this._removeEnvironmentStackName,
        isLoadingImpact: this._isLoadingEnvironmentImpact,
        impact: this.environmentImpactLines,
        impactTotal: totalDeletionImpact(this.environmentImpactLines),
      },
      deploymentDialog: this.buildDeploymentDialog(stackRows, currentEnvironmentVM, project?.name),
      systemInfo: buildSystemInfo(stackRows, currentEnvironmentVM, project?.versionMajor ?? null),
      systemInfoNotice: systemInfoNotice(stackRows, currentEnvironmentVM),
      showEnvironmentSelector: environmentVMs.length > 1,
      environmentError: this._environmentError,
      loadError: this._loadError,
      projectHealth: this._projectHealth,
      projectHealthError: this._projectHealthError,
      isLoading: this._isLoading,
      isSyncing: this._isSyncing,
      showEditDialog: this._showEditDialog,
      syncPreview: this.syncPreviewState.vm,
    };
  }

  /** Both ids together, or null until an environment has been resolved. */
  private get currentEnvironment(): ProjectEnvironment | null {
    if (!this._projectId || !this._environmentId) {
      return null;
    }
    const environmentId = this._environmentId;
    return (
      this.environmentsRepository
        .getEnvironmentsByProjectId(this._projectId)
        .find((environment) => environment.id === environmentId) ?? null
    );
  }

  private get ref(): EnvironmentRef | null {
    if (!this._projectId || !this._environmentId) {
      return null;
    }
    return { projectId: this._projectId, environmentId: this._environmentId };
  }

  /**
   * A failed load is never marked loaded. Keying "already here" off `_projectId`/`_envName` meant
   * a failed read still looked like a successful one, so re-entering the page short-circuited and
   * left it on an error banner with nothing able to ask again.
   */
  public load = async (projectId: string, envName: string | null): Promise<void> => {
    const key = `${projectId}|${envName ?? ""}`;
    if (this._loadingProjectId === projectId || this._loadedKey === key) {
      return;
    }
    this._loadingProjectId = projectId;
    this._loadedKey = null;
    this._projectId = projectId;
    this._envName = envName;
    this._environmentId = null;
    this._environmentError = null;
    this._loadError = null;
    this._stacksLoadedFor = null;
    this._isLoading = true;
    try {
      const loaded = await this.loadProjectDetailUseCase.execute({ projectId });
      if (loaded.isFail()) {
        // Without this the page renders its whole frame around a project that was never there.
        runInAction(() => {
          this._loadError = loaded.error.message;
        });
        return;
      }
      runInAction(() => {
        this._loadedKey = key;
      });
      await this.resolveEnvironment(projectId, envName);
    } finally {
      runInAction(() => {
        this._loadingProjectId = null;
        this._isLoading = false;
      });
    }
    void this.checkHealth();
  };

  /**
   * Environments are addressed by stack name in the URL, so they must be listed before anything
   * else can load. With no name in the URL the first environment is taken — the common case, since
   * most projects have only `dev`.
   */
  private resolveEnvironment = async (projectId: string, envName: string | null): Promise<void> => {
    /**
     * Archived environments are listed so the Environments tab can offer Restore next to them.
     * They are never auto-selected: archiving is "stop looking at this stack", and landing on one
     * would undo that on every page load.
     */
    const result = await this.environmentsGateway.listForProject(projectId, true);

    if (result.isFail()) {
      runInAction(() => {
        this._environmentError = result.error.message;
      });
      return;
    }

    const environments = result.value;
    this.environmentsRepository.setEnvironments(projectId, environments);

    const active = environments.filter((environment) => environment.archivedAt === null);

    const selected =
      envName === null
        ? (active[0] ?? null)
        : this.environmentsRepository.findByStackName(projectId, envName);

    runInAction(() => {
      if (selected === null) {
        this._environmentId = null;
        this._environmentError =
          active.length === 0
            ? "This project has no environments yet. Sync it to discover them."
            : `Environment "${envName ?? ""}" not found in this project.`;
        return;
      }
      this._environmentId = selected.id;
      this._envName = getStackName({ env: selected.env, variant: selected.variant });
      this._environmentError = null;
    });
  };

  /**
   * Reads the selected environment's Pulumi stacks, once per environment. The Environments and
   * System Info tabs are the two that render them, and both belong to this page's frame rather
   * than being tabs of their own, so the page asks for this when it shows one of them.
   *
   * A failed read is not recorded as loaded: showing the tab again tries once more.
   */
  public loadStacks = async (): Promise<void> => {
    const ref = this.ref;
    if (ref === null || this._isLoadingStacks || this._stacksLoadedFor === ref.environmentId) {
      return;
    }
    this._isLoadingStacks = true;
    try {
      const result = await this.environmentsGateway.listStacks(ref.projectId, ref.environmentId);
      if (result.isFail()) {
        this.notifications.error(`Could not load stacks: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.environmentsRepository.setStacks(ref.environmentId, result.value);
        this._stacksLoadedFor = ref.environmentId;
      });
    } finally {
      runInAction(() => {
        this._isLoadingStacks = false;
      });
    }
  };

  public checkHealth = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._projectHealth = "checking";
    this._projectHealthError = null;
    const result = await this.projectsGateway.healthCheck(ref);
    runInAction(() => {
      if (result.isFail()) {
        this._projectHealth = "unreachable";
        this._projectHealthError = result.error.message;
        return;
      }
      this._projectHealth = result.value.reachable ? "reachable" : "unreachable";
      this._projectHealthError = result.value.error;
    });
  };

  /**
   * Opens the diff rather than syncing. A sync overwrites what is stored for the project with
   * whatever the checkout currently says, so what it would change is shown first.
   */
  public syncProject = (): void => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }
    void this.syncPreviewState.open([projectId]);
  };

  public applySync = async (): Promise<void> => {
    await this.syncPreviewState.apply();
  };

  public closeSyncPreview = (): void => {
    this.syncPreviewState.close();
  };

  public openDeploymentDialog = (command: "deploy" | "destroy"): void => {
    this._deploymentCommand = command;
    this._deploymentStep = "review";
    this._deploymentTypedName = "";
    this._deploymentError = null;
    this._selectedApps = [];
    this._deploymentRegion = null;
    this._deploymentPreview = false;
    void this.loadDeployableApps();
  };

  public closeDeploymentDialog = (): void => {
    this._deploymentCommand = null;
    this._deploymentStep = "review";
    this._deploymentTypedName = "";
    this._deploymentError = null;
    this._selectedApps = [];
  };

  public toggleDeploymentApp = (app: string): void => {
    this._selectedApps = this._selectedApps.includes(app)
      ? this._selectedApps.filter((candidate) => candidate !== app)
      : [...this._selectedApps, app];
  };

  public setDeploymentRegion = (region: string | null): void => {
    this._deploymentRegion = region;
  };

  public toggleDeploymentPreview = (): void => {
    this._deploymentPreview = !this._deploymentPreview;
  };

  public reviewDeployment = (): void => {
    this._deploymentStep = "confirm";
  };

  public setDeploymentTypedName = (value: string): void => {
    this._deploymentTypedName = value;
  };

  public submitDeployment = async (): Promise<void> => {
    const command = this._deploymentCommand;
    const projectId = this._projectId;
    const environmentId = this._environmentId;

    if (command === null || projectId === null || environmentId === null) {
      return;
    }

    this._isSubmittingDeployment = true;
    this._deploymentError = null;

    try {
      const apps = this._selectedApps;
      const region = this._deploymentRegion;

      const result =
        command === "deploy"
          ? await this.environmentsGateway.deploy(projectId, environmentId, {
              ...(apps.length > 0 ? { apps } : {}),
              ...(region !== null ? { region } : {}),
              ...(this._deploymentPreview ? { preview: true } : {}),
            })
          : await this.environmentsGateway.destroy(projectId, environmentId, {
              ...(apps.length > 0 ? { apps } : {}),
              ...(region !== null ? { region } : {}),
              confirmProjectName: this._deploymentTypedName.trim(),
            });

      if (result.isFail()) {
        runInAction(() => {
          this._deploymentError = result.error.message;
        });
        return;
      }

      this.notifications.success(
        command === "destroy"
          ? "Destroy started."
          : this._deploymentPreview
            ? "Preview started. Nothing will be changed."
            : "Deploy started.",
      );
      this.closeDeploymentDialog();
    } finally {
      runInAction(() => {
        this._isSubmittingDeployment = false;
      });
    }
  };

  public confirmRemoveEnvironment = (environmentId: string, stackName: string): void => {
    this._removeEnvironmentId = environmentId;
    this._removeEnvironmentStackName = stackName;
    this._removeEnvironmentMode = "archive";
    this._environmentImpact = null;
    void this.loadEnvironmentImpact(environmentId);
  };

  public cancelRemoveEnvironment = (): void => {
    this._removeEnvironmentId = null;
    this._removeEnvironmentStackName = null;
    this._removeEnvironmentMode = "archive";
    this._environmentImpact = null;
  };

  public requestPurgeEnvironment = (): void => {
    this._removeEnvironmentMode = "purge";
  };

  public archiveEnvironment = async (): Promise<void> => {
    const projectId = this._projectId;
    const environmentId = this._removeEnvironmentId;
    const stackName = this._removeEnvironmentStackName;
    if (projectId === null || environmentId === null) {
      return;
    }
    this.cancelRemoveEnvironment();

    const result = await this.environmentsGateway.archive(projectId, environmentId);
    if (result.isFail()) {
      this.notifications.error(`Failed to archive environment: ${result.error.message}`);
      return;
    }

    this.notifications.success(`Environment "${stackName}" archived. Its data is kept.`);
    await this.reloadEnvironments();
  };

  public purgeEnvironment = async (): Promise<void> => {
    const projectId = this._projectId;
    const environmentId = this._removeEnvironmentId;
    const stackName = this._removeEnvironmentStackName;
    if (projectId === null || environmentId === null) {
      return;
    }
    /**
     * The confirmation has to have been moved to "purge" first. This destroys every seed entry,
     * sync log, model and job that hangs off the environment, so it must not be reachable from the
     * dialog's reversible first step by any route.
     */
    if (this._removeEnvironmentMode !== "purge") {
      return;
    }
    this.cancelRemoveEnvironment();

    const result = await this.environmentsGateway.purge(projectId, environmentId);
    if (result.isFail()) {
      this.notifications.error(`Failed to delete environment: ${result.error.message}`);
      return;
    }

    this.notifications.success(`Environment "${stackName}" and all of its data were deleted.`);

    /**
     * The purged environment may be the one the URL addresses. Reloading resolves the project's
     * first remaining environment, rather than leaving the page pointed at a row that is gone.
     */
    if (environmentId === this._environmentId) {
      this._environmentId = null;
      this._envName = null;
    }
    await this.reloadEnvironments();
  };

  public restoreEnvironment = async (environmentId: string): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }

    const result = await this.environmentsGateway.restore(projectId, environmentId);
    if (result.isFail()) {
      this.notifications.error(`Failed to restore environment: ${result.error.message}`);
      return;
    }

    await this.reloadEnvironments();
  };

  public openEditDialog = (): void => {
    this._showEditDialog = true;
  };

  public closeEditDialog = (): void => {
    this._showEditDialog = false;
  };

  public submitEdit = async (input: IEditProjectInput): Promise<boolean> => {
    const projectId = this._projectId;
    if (!projectId) {
      return false;
    }
    const result = await this.projectsGateway.update(projectId, input);
    if (result.isOk()) {
      this.projectsRepository.updateProject(result.value);
      this.notifications.success("Project updated.");
      this._showEditDialog = false;
      return true;
    }
    this.notifications.error("Failed to update project.");
    return false;
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
  };

  private loadDeployableApps = async (): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }

    const result = await this.environmentsGateway.listDeployableApps(projectId);
    runInAction(() => {
      // An empty list is a real answer — a remote-only project can deploy nothing — so a failure
      // leaves whatever was there rather than claiming there is nothing to deploy.
      if (result.isOk()) {
        this._deployableApps = result.value.apps;
      }
    });
  };

  /**
   * The deploy and destroy dialog.
   *
   * The "at risk" list is built from the stored stacks rather than from a fresh read: it is what
   * the last sync saw, which is the only honest thing to show before running anything. An
   * unreadable stack reports a null count instead of zero.
   */
  /** The version the key maps are read through. Null for a workspace root, which resolves none. */
  private get currentVersionMajor(): number | null {
    if (this._projectId === null) {
      return null;
    }
    return (
      this.projectsRepository.projects.find((project) => project.id === this._projectId)
        ?.versionMajor ?? null
    );
  }

  private buildDeploymentDialog(
    stacks: ProjectStack[],
    environment: IEnvironmentVM | null,
    projectName: string | undefined,
  ): IDeploymentDialogVM {
    const command = this._deploymentCommand ?? "deploy";
    const isDestroy = command === "destroy";
    const name = projectName ?? "";

    const targeted =
      this._selectedApps.length > 0
        ? this._selectedApps
        : this._deployableApps.length > 0
          ? this._deployableApps
          : stacks.map((stack) => stack.app);

    const atRisk = isDestroy
      ? targeted.map((app) => {
          const stack = stacks.find((candidate) => candidate.app === app);
          return {
            app,
            resourceCount:
              stack === undefined || stack.readState === "unknown"
                ? null
                : (stack.resourceCount ?? 0),
            deployed: stack?.deployed ?? false,
          };
        })
      : [];

    return {
      isOpen: this._deploymentCommand !== null,
      command,
      step: this._deploymentStep,
      stackName: environment?.stackName ?? null,
      projectName: name,
      deployableApps: this._deployableApps,
      selectedApps: this._selectedApps,
      // Null means "whatever the environment already uses", which is what the backend falls back to.
      region: this._deploymentRegion,
      regionOptions: WEBINY_REGIONS,
      preview: this._deploymentPreview,
      atRisk,
      atRiskResources: isDestroy
        ? namedResourcesAtRisk(stacks, targeted, this.currentVersionMajor)
        : [],
      typedName: this._deploymentTypedName,
      canConfirm: isDestroy
        ? this._deploymentTypedName.trim() === name && name !== ""
        : this._deployableApps.length > 0,
      isSubmitting: this._isSubmittingDeployment,
      error: this._deploymentError,
    };
  }
  private get environmentImpactLines(): Array<{ label: string; count: number }> {
    return this._environmentImpact === null ? [] : toDeletionImpactLines(this._environmentImpact);
  }

  private loadEnvironmentImpact = async (environmentId: string): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }

    this._isLoadingEnvironmentImpact = true;
    try {
      const result = await this.environmentsGateway.deletionImpact(projectId, environmentId);
      runInAction(() => {
        // A failed count must not become a silent "nothing will be lost".
        this._environmentImpact = result.isOk() ? result.value : null;
      });
    } finally {
      runInAction(() => {
        this._isLoadingEnvironmentImpact = false;
      });
    }
  };

  /**
   * Reads the environment list again and re-resolves which one the page is on.
   *
   * Delegates to the same routine the initial load uses, because everything that follows the list
   * — the selection, the "no environments yet" notice, the stack name in the URL — is decided
   * there. Reloading only the dataset stored the new rows and left the rest saying what it said
   * before: after a sync discovered a project's first environment, the page listed it while still
   * reporting that there were none, with nothing selected and every environment action dead.
   */
  private reloadEnvironments = async (): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }

    await this.resolveEnvironment(projectId, this._envName);
  };

  /**
   * Only the two datasets this presenter still owns. Every tab subscribes for its own, so a job
   * that writes a tab's data reaches that tab directly.
   *
   * The environment list is not just another dataset: what it holds decides which environment the
   * page is on, so it goes through `reloadEnvironments`, which re-runs the whole selection.
   */
  private handleJobStatus = (event: WSJobStatus): void => {
    if (!this._projectId || event.projectId !== this._projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    // The descriptor table is the single source for this map; a local copy is what drifted before.
    const datasets = getJobTypeDatasets(event.type);
    if (datasets.includes("environments")) {
      void this.reloadEnvironments();
    }
    if (datasets.includes("stacks")) {
      this._stacksLoadedFor = null;
      void this.loadStacks();
    }
  };
}

export const ProjectDetailPresenter = Abstraction.createImplementation({
  implementation: ProjectDetailPresenterImpl,
  dependencies: [
    LoadProjectDetailUseCase,
    ProjectsGateway,
    ProjectsRepository,
    EnvironmentsGateway,
    EnvironmentsRepository,
    JobsGateway,
    NotificationService,
    EventBridge,
  ],
});
