import { makeAutoObservable, runInAction } from "mobx";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import { SyncPreviewState } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import type {
  IDeploymentDialogVM,
  IEnvironmentVM,
  IProjectDetailVM,
  IEditProjectInput,
  IMergedFileVM,
  IStackVM,
} from "./abstractions/ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/abstractions/LoadProjectDetailUseCase.js";
import { DeleteTemplateUseCase } from "./useCases/DeleteTemplate/abstractions/DeleteTemplateUseCase.js";
import { ProjectsGateway } from "~/ui/features/projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "~/ui/features/projects/abstractions/ProjectsRepository.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { TemplatesGateway } from "~/ui/features/templates/abstractions/TemplatesGateway.js";
import { TemplatesRepository } from "~/ui/features/templates/abstractions/TemplatesRepository.js";
import { FilesGateway } from "~/ui/features/files/abstractions/FilesGateway.js";
import { FilesRepository } from "~/ui/features/files/abstractions/FilesRepository.js";
import { LocalFilesGateway } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import { LocalFilesRepository } from "~/ui/features/localFiles/abstractions/LocalFilesRepository.js";
import type { ILocalFileVM } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import type {
  DeletionImpact,
  EnvironmentRef,
  ProjectEnvironment,
  ProjectFile,
  ProjectStack,
} from "~/shared/types.js";
import { toDeletionImpactLines, totalDeletionImpact } from "~/shared/deletion/impactLines.js";
import { buildSystemInfo, namedResourcesAtRisk, systemInfoNotice } from "./systemInfo.js";
import { LiveJobLogs } from "./LiveJobLogs.js";
import { ProjectDatasets } from "./ProjectDatasets.js";
import type { IDatasetContext } from "./ProjectDatasets.js";
import { buildProjectDatasets } from "./projectDatasetDefinitions.js";
import { getStackName } from "~/shared/environments/index.js";
import { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import { EnvironmentsRepository } from "~/ui/features/environments/abstractions/EnvironmentsRepository.js";
import { EntriesGateway } from "~/ui/features/entries/abstractions/EntriesGateway.js";
import { EntriesRepository } from "~/ui/features/entries/abstractions/EntriesRepository.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import { navigate } from "~/ui/features/router/Router.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobLog, WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { WEBINY_REGIONS } from "~/shared/webiny/regions.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { JobsRepository } from "~/ui/features/jobs/abstractions/JobsRepository.js";

const VIEW_DATASETS: Record<string, string[]> = {
  environments: ["stacks"],
  system: ["stacks"],
  tenants: ["tenants"],
  models: ["models"],
  files: ["files"],
  entries: ["entries"],
  history: ["seedJobs"],
  templates: ["templates"],
  "pull-tenants": ["syncLogs"],
  "pull-models": ["syncLogs"],
  "pull-images": ["syncLogs"],
  jobs: ["jobs"],
  activity: ["syncLogs"],
  seed: ["tenants", "models"],
  import: ["tenants", "models"],
};

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
  private _isSyncingTenants = false;
  private _isSyncingModels = false;
  private _isImporting = false;
  private _isClearingEntries = false;
  private _isCleaningUp = false;
  private _isUploadingGlobal = false;
  private _isPullingFiles = false;
  private _showEditDialog = false;
  private _showCleanupDialog = false;
  private _loadingProjectId: string | null = null;
  private _projectHealth: "unknown" | "checking" | "reachable" | "unreachable" = "unknown";
  private _projectHealthError: string | null = null;
  private readonly entriesListState: URLListState.Interface;
  private readonly jobsListState: URLListState.Interface;
  private readonly syncLogsListState: URLListState.Interface;
  private readonly seedJobsListState: URLListState.Interface;
  private readonly disposeJobSubscription: () => void;
  private readonly disposeJobLogSubscription: () => void;
  private readonly liveLogs = new LiveJobLogs();
  private readonly datasets: ProjectDatasets;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly syncPreviewState: SyncPreviewState;

  public constructor(
    private readonly loadProjectDetailUseCase: LoadProjectDetailUseCase.Interface,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly environmentsRepository: EnvironmentsRepository.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
    private readonly filesGateway: FilesGateway.Interface,
    private readonly filesRepository: FilesRepository.Interface,
    private readonly localFilesGateway: LocalFilesGateway.Interface,
    private readonly localFilesRepository: LocalFilesRepository.Interface,
    private readonly entriesGateway: EntriesGateway.Interface,
    private readonly entriesRepository: EntriesRepository.Interface,
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
    private readonly jobsGateway: JobsGateway.Interface,
    private readonly jobsRepository: JobsRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    private readonly urlListStateFactory: URLListStateFactory.Interface,
    private readonly eventBridge: EventBridge.Interface,
  ) {
    this.entriesListState = urlListStateFactory.create({
      filters: {
        jobId: { type: "dropdown" },
        modelId: { type: "dropdown" },
        tenant: { type: "dropdown" },
        status: { type: "dropdown" },
      },
      onChange: () => this.datasets.reload("entries"),
    });
    this.jobsListState = urlListStateFactory.create({
      filters: {
        jobType: { type: "dropdown" },
        jobStatus: { type: "dropdown" },
      },
      onChange: () => this.datasets.reload("jobs"),
    });
    this.syncLogsListState = urlListStateFactory.create({
      filters: {
        logType: { type: "dropdown" },
        logStatus: { type: "dropdown" },
      },
      onChange: () => this.datasets.reload("syncLogs"),
    });
    this.seedJobsListState = urlListStateFactory.create({
      filters: {
        seedStatus: { type: "dropdown" },
      },
      onChange: () => this.datasets.reload("seedJobs"),
    });
    this.syncPreviewState = new SyncPreviewState(environmentsGateway, jobsGateway, notifications);
    this.datasets = new ProjectDatasets(
      buildProjectDatasets({
        listStates: {
          entries: this.entriesListState,
          seedJobs: this.seedJobsListState,
          syncLogs: this.syncLogsListState,
          jobs: this.jobsListState,
        },
        notifications,
        environmentsGateway,
        environmentsRepository,
        tenantsGateway,
        tenantsRepository,
        modelsGateway,
        modelsRepository,
        filesGateway,
        filesRepository,
        localFilesGateway,
        localFilesRepository,
        entriesGateway,
        entriesRepository,
        seedingGateway,
        seedingRepository,
        templatesGateway,
        templatesRepository,
        syncLogsGateway,
        syncLogsRepository,
        jobsGateway,
        jobsRepository,
      }),
      () => this.datasetContext,
    );
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
    this.disposeJobLogSubscription = eventBridge.on("job:log", this.handleJobLog);
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

    const tenants = environmentId
      ? this.tenantsRepository.getTenantsByEnvironmentId(environmentId)
      : [];

    const models = environmentId
      ? this.modelsRepository.getModelsByEnvironmentId(environmentId)
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

    const seedJobs = environmentId ? this.seedingRepository.seedJobs : [];
    const jobs = this._projectId ? this.jobsRepository.jobs : [];

    const templates = this._projectId
      ? this.templatesRepository.getTemplatesByProjectId(this._projectId)
      : [];

    const files = environmentId ? this.filesRepository.getFilesByEnvironmentId(environmentId) : [];
    const localFiles = this._projectId ? this.localFilesRepository.files : [];
    const mergedFiles = this.buildMergedFiles(files, localFiles);

    const entries = environmentId
      ? this.entriesRepository.getEntriesByEnvironmentId(environmentId)
      : [];

    const syncLogs = environmentId
      ? this.syncLogsRepository.getLogsByEnvironmentId(environmentId)
      : [];

    const stackRows = environmentId ? this.environmentsRepository.getStacks(environmentId) : [];
    const stacks = stackRows.map(toStackVM);

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
      stacks,
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
      tenants: tenants.map((tenant) => ({
        tenantId: tenant.tenantId,
        name: tenant.name,
        discoveredAt: tenant.discoveredAt,
      })),
      groups: Array.from(groupMap.values()),
      models: models.map((model) => ({
        modelId: model.modelId,
        name: model.name,
        groupSlug: model.groupSlug,
        fieldCount: model.fields.length,
        fields: model.fields,
        syncedAt: model.syncedAt,
      })),
      seedJobs: seedJobs.map((seedJob) => ({
        id: seedJob.id,
        status: seedJob.status,
        modelCount: seedJob.config.models.length,
        entriesCreated: seedJob.result?.created ?? 0,
        errorCount: seedJob.result?.errors.length ?? 0,
        createdAt: seedJob.createdAt,
      })),
      seedJobsTotalCount: this._projectId ? this.seedingRepository.totalSeedJobs : 0,
      seedJobsPage: this.seedJobsListState.page,
      seedJobsStatusFilter: this.seedJobsListState.get("seedStatus") || null,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        config: template.config,
      })),
      files: files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        tenant: file.tenant,
        uploadedAt: file.uploadedAt,
      })),
      mergedFiles,
      entries: entries.map((entry) => ({
        id: entry.id,
        modelId: entry.modelId,
        tenant: entry.tenant,
        status: entry.status,
        entryId: entry.entryId,
        entryData: entry.entryData,
        requestData: entry.requestData,
        responseData: entry.responseData,
        error: entry.error,
        createdAt: entry.createdAt,
      })),
      entriesTotalCount: environmentId ? this.entriesRepository.totalEntries : 0,
      entriesPage: this.entriesListState.page,
      entriesJobFilter: this.entriesListState.get("jobId") || null,
      entriesModelFilter: this.entriesListState.get("modelId") || null,
      entriesTenantFilter: this.entriesListState.get("tenant") || null,
      entriesStatusFilter: this.entriesListState.get("status") || null,
      syncLog: syncLogs.map((log) => ({
        id: log.id,
        type: log.type,
        status: log.status,
        message: log.message,
        request: log.request,
        response: log.response,
        createdAt: log.createdAt,
      })),
      syncLogsTotalCount: environmentId ? this.syncLogsRepository.totalLogs : 0,
      syncLogsPage: this.syncLogsListState.page,
      syncLogsTypeFilter: this.syncLogsListState.get("logType") || null,
      syncLogsStatusFilter: this.syncLogsListState.get("logStatus") || null,
      jobs,
      jobsTotalCount: this._projectId ? this.jobsRepository.totalJobs : 0,
      jobsPage: this.jobsListState.page,
      jobsTypeFilter: this.jobsListState.get("jobType") || null,
      jobsStatusFilter: this.jobsListState.get("jobStatus") || null,
      projectHealth: this._projectHealth,
      projectHealthError: this._projectHealthError,
      isLoading: this._isLoading,
      isSyncing: this._isSyncing,
      isSyncingTenants: this._isSyncingTenants,
      isSyncingModels: this._isSyncingModels,
      isImporting: this._isImporting,
      isClearingEntries: this._isClearingEntries,
      isCleaningUp: this._isCleaningUp,
      isUploadingGlobal: this._isUploadingGlobal,
      isPullingFiles: this._isPullingFiles,
      showCleanupDialog: this._showCleanupDialog,
      confirmation: this.actionConfirmation.vm,
      syncPreview: this.syncPreviewState.vm,
      showEditDialog: this._showEditDialog,
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

  public load = async (projectId: string, envName: string | null): Promise<void> => {
    const alreadyLoaded = this._projectId === projectId && this._envName === envName;
    if (this._loadingProjectId === projectId || alreadyLoaded) {
      return;
    }
    this._loadingProjectId = projectId;
    this._projectId = projectId;
    this._envName = envName;
    this._environmentId = null;
    this._environmentError = null;
    this._loadError = null;
    this.datasets.clear();
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

  /**
   * Loads what a tab needs, per dataset rather than per view.
   *
   * There is no environment guard here: `ProjectDatasets` skips the datasets that address one
   * stack until an environment is resolved, and lets the project-scoped ones through. Guarding the
   * whole view left Jobs and Templates permanently blank on a project that has no environment —
   * a remote-only one, or one whose sync found no stacks — even though neither reads a stack.
   */
  public activateView = async (view: string): Promise<void> => {
    const datasets = VIEW_DATASETS[view];
    if (!datasets) {
      return;
    }
    await this.datasets.loadAll(datasets);
  };

  public loadEntriesPage = (page: number): void => {
    this.entriesListState.setPage(page);
  };

  public setEntriesFilter = (key: string, value: string | null): void => {
    this.entriesListState.set(key, value ?? "");
  };

  public viewJobEntries = (jobId: string): void => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    navigate(AppRoutes.environmentTab(ref.projectId, this._envName ?? "", "entries"));
    this.entriesListState.setBatch({ jobId, modelId: null, tenant: null, status: null });
  };

  public clearEntriesFilter = (): void => {
    this.entriesListState.setBatch({ jobId: null, modelId: null, tenant: null, status: null });
  };

  public loadTemplate = (_templateId: string): void => {
    if (this._projectId) {
      navigate(AppRoutes.seedConfig(this._projectId, this._envName ?? ""));
    }
  };

  public deleteTemplate = async (templateId: string): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.deleteTemplateUseCase.execute({
      projectId: ref.projectId,
      templateId,
    });
    if (result.isFail()) {
      this.notifications.error(`Failed to delete template: ${result.error.message}`);
      return;
    }
    this.notifications.success("Template deleted.");
  };

  public pullTenants = (): void => {
    const environment = this.currentEnvironment;
    if (environment === null) {
      return;
    }

    this.actionConfirmation.request({
      title: "Pull tenants",
      message:
        `Read every tenant from the live system on ${getStackName(environment)} and replace the ` +
        `tenant list stored for this environment?`,
      confirmLabel: "Pull tenants",
      run: this.runPullTenants,
    });
  };

  private runPullTenants = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._isSyncingTenants = true;
    try {
      const result = await this.tenantsGateway.syncForProject(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Tenant pull job started.");
        } else {
          this.notifications.error(`Failed to start tenant pull: ${result.error.message}`);
        }
        this._isSyncingTenants = false;
      });
    } catch {
      runInAction(() => {
        this._isSyncingTenants = false;
      });
    }
  };

  public pullModels = (): void => {
    const environment = this.currentEnvironment;
    if (environment === null) {
      return;
    }

    this.actionConfirmation.request({
      title: "Pull models",
      message:
        `Read every content model from the live system on ${getStackName(environment)} and ` +
        `replace the models stored for this environment?`,
      confirmLabel: "Pull models",
      run: this.runPullModels,
    });
  };

  private runPullModels = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._isSyncingModels = true;
    try {
      const result = await this.modelsGateway.pullModels(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Model pull job started.");
        } else {
          this.notifications.error(`Failed to start model pull: ${result.error.message}`);
        }
        this._isSyncingModels = false;
      });
    } catch {
      runInAction(() => {
        this._isSyncingModels = false;
      });
    }
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

  public clearEntries = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._isClearingEntries = true;
    try {
      const result = await this.entriesGateway.clear(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.entriesRepository.clearEntries(this._projectId!);
          this.notifications.success("Audit log cleared.");
        } else {
          this.notifications.error("Failed to clear audit log.");
        }
      });
    } finally {
      runInAction(() => {
        this._isClearingEntries = false;
      });
    }
  };

  public deleteFile = async (fileId: string): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.filesGateway.remove(ref, fileId);
    if (result.isOk()) {
      this.filesRepository.removeFile(fileId);
      this.notifications.success("File deleted.");
    } else {
      this.notifications.error("Failed to delete file.");
    }
  };

  public uploadFilesToProject = async (files: File[]): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const tenant = this.currentTenant();
    const failures: string[] = [];

    for (const file of files) {
      try {
        const fileContent = await readFileAsBase64(file);
        const result = await this.filesGateway.upload(ref, {
          tenant,
          fileName: file.name,
          fileContent,
          fileType: file.type,
        });
        if (result.isFail()) {
          failures.push(`${file.name}: ${result.error.message}`);
        }
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    runInAction(() => {
      if (failures.length > 0) {
        this.notifications.error(`Some files failed to upload: ${failures.join("; ")}`);
      } else {
        this.notifications.success("Files uploaded.");
      }
    });

    await this.datasets.reload("files");
  };

  public uploadAllGlobalImages = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const tenant = this.currentTenant();
    this._isUploadingGlobal = true;
    try {
      const result = await this.localFilesGateway.uploadGlobalToProject(ref, { tenant });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Upload job started.");
        } else {
          this.notifications.error(`Failed to upload global images: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isUploadingGlobal = false;
      });
    }
  };

  public uploadSelectedGlobalImages = async (fileNames: string[]): Promise<void> => {
    const ref = this.ref;
    if (!ref || fileNames.length === 0) {
      return;
    }
    const tenant = this.currentTenant();
    this._isUploadingGlobal = true;
    try {
      const result = await this.localFilesGateway.uploadGlobalToProject(ref, {
        tenant,
        fileNames,
      });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Upload job started.");
        } else {
          this.notifications.error(`Failed to upload selected images: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isUploadingGlobal = false;
      });
    }
  };

  public deleteSyncLog = async (logId: string): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.syncLogsGateway.remove(ref, logId);
    if (result.isOk()) {
      this.syncLogsRepository.removeLog(logId);
      this.notifications.success("Sync log deleted.");
    } else {
      this.notifications.error("Failed to delete sync log.");
    }
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  public openCleanupDialog = (): void => {
    this._showCleanupDialog = true;
  };

  public closeCleanupDialog = (): void => {
    this._showCleanupDialog = false;
  };

  public confirmCleanup = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._showCleanupDialog = false;
    this._isCleaningUp = true;
    try {
      const result = await this.seedingGateway.cleanupEntries(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Cleanup job started.");
        } else {
          this.notifications.error(`Cleanup failed: ${result.error.message}`);
        }
        this._isCleaningUp = false;
      });
    } catch {
      runInAction(() => {
        this._isCleaningUp = false;
      });
    }
  };

  public importEntries = (tenant: string, modelIds: string[]): void => {
    const environment = this.currentEnvironment;
    if (environment === null || modelIds.length === 0) {
      return;
    }

    this.actionConfirmation.request({
      title: "Import entries",
      message:
        `Read every entry of ${modelIds.length} model(s) from tenant "${tenant}" on ` +
        `${getStackName(environment)} and store them here?`,
      confirmLabel: "Import entries",
      run: () => this.runImportEntries(tenant, modelIds),
    });
  };

  private runImportEntries = async (tenant: string, modelIds: string[]): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    this._isImporting = true;
    try {
      const result = await this.seedingGateway.importEntries(ref, {
        tenant,
        models: modelIds,
      });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Import job started.");
        } else {
          this.notifications.error(`Import failed: ${result.error.message}`);
        }
        this._isImporting = false;
      });
    } catch {
      runInAction(() => {
        this._isImporting = false;
      });
    }
  };

  public loadSeedJobsPage = (page: number): void => {
    this.seedJobsListState.setPage(page);
  };

  public setSeedJobsFilter = (key: string, value: string | null): void => {
    this.seedJobsListState.set(key, value ?? "");
  };

  public clearSeedJobsFilter = (): void => {
    this.seedJobsListState.setBatch({ seedStatus: null });
  };

  public loadJobsPage = (page: number): void => {
    this.jobsListState.setPage(page);
  };

  public setJobsFilter = (key: string, value: string | null): void => {
    this.jobsListState.set(key, value ?? "");
  };

  public clearJobsFilter = (): void => {
    this.jobsListState.setBatch({ jobType: null, jobStatus: null });
  };

  public loadSyncLogsPage = (page: number): void => {
    this.syncLogsListState.setPage(page);
  };

  public setSyncLogsFilter = (key: string, value: string | null): void => {
    this.syncLogsListState.set(key, value ?? "");
  };

  public clearSyncLogsFilter = (): void => {
    this.syncLogsListState.setBatch({ logType: null, logStatus: null });
  };

  public pullFiles = (): void => {
    const environment = this.currentEnvironment;
    if (environment === null) {
      return;
    }

    this.actionConfirmation.request({
      title: "Pull files",
      message:
        `Download the File Manager contents of tenant "${this.currentTenant()}" on ` +
        `${getStackName(environment)} into this tool?`,
      confirmLabel: "Pull files",
      run: this.runPullFiles,
    });
  };

  private runPullFiles = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const tenant = this.currentTenant();
    this._isPullingFiles = true;
    try {
      const result = await this.filesGateway.pullFiles(ref, tenant);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success(`Pulled ${result.value.synced} file(s) from File Manager.`);
        } else {
          this.notifications.error(`Failed to pull files: ${result.error.message}`);
        }
      });
      await this.datasets.reload("files");
    } finally {
      runInAction(() => {
        this._isPullingFiles = false;
      });
    }
  };

  public cancelJob = async (jobId: string): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.jobsGateway.cancel(ref.projectId, jobId);
    runInAction(() => {
      if (result.isOk()) {
        this.notifications.success("Job cancelled.");
      } else {
        this.notifications.error(`Failed to cancel job: ${result.error.message}`);
      }
    });
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
    this.disposeJobLogSubscription();
  };

  /**
   * Live log lines for one job, joined for the viewer. Empty until the job emits something, at
   * which point this is what the detail modal shows instead of the stored `logs` column — that one
   * is only flushed every couple of seconds.
   */
  public liveLogsFor = (jobId: string): string => {
    return this.liveLogs.for(jobId);
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
   * Reads the environment list again and re-points the page when it has nothing selected — after
   * a purge of the environment the URL addressed, or before one has been resolved at all.
   */
  private reloadEnvironments = async (): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null) {
      return;
    }

    await this.datasets.reload("environments");

    runInAction(() => {
      if (this._environmentId === null) {
        this._environmentId =
          this.environmentsRepository
            .getEnvironmentsByProjectId(projectId)
            .find((environment) => environment.archivedAt === null)?.id ?? null;
      }
    });
  };

  private handleJobLog = (event: WSJobLog): void => {
    if (this._projectId === null || event.projectId !== this._projectId) {
      return;
    }
    this.liveLogs.append(event.jobId, event.line);
  };

  private handleJobStatus = (event: WSJobStatus): void => {
    if (!this._projectId || event.projectId !== this._projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    // The descriptor table is the single source for this map; a local copy is what drifted before.
    const datasetsToReload = getJobTypeDatasets(event.type);
    if (datasetsToReload.length === 0) {
      return;
    }
    void this.datasets.reloadAll(datasetsToReload);
  };

  private get datasetContext(): IDatasetContext | null {
    const projectId = this._projectId;
    return projectId === null ? null : { projectId, ref: this.ref };
  }

  private currentTenant = (): string => {
    return this.currentEnvironment?.tenant ?? "root";
  };

  private buildMergedFiles = (
    projectFiles: ProjectFile[],
    localFiles: ILocalFileVM[],
  ): IMergedFileVM[] => {
    const projectFileNames = new Set(projectFiles.map((file) => file.fileName));

    const projectMerged: IMergedFileVM[] = projectFiles.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      source: "project",
      thumbnailUrl: file.fileUrl,
      badges: [{ label: "project", color: "blue" }],
    }));

    const globalMerged: IMergedFileVM[] = localFiles
      .filter((file) => !projectFileNames.has(file.fileName))
      .map((file) => ({
        id: file.fileName,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        source: "global",
        thumbnailUrl: `/api/files/local/${encodeURIComponent(file.fileName)}/content`,
        badges: [{ label: "global", color: "gray" }],
      }));

    return [...projectMerged, ...globalMerged];
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read file "${file.name}"`));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read file "${file.name}"`));
    };
    reader.readAsDataURL(file);
  });
}

export const ProjectDetailPresenter = Abstraction.createImplementation({
  implementation: ProjectDetailPresenterImpl,
  dependencies: [
    LoadProjectDetailUseCase,
    DeleteTemplateUseCase,
    ProjectsGateway,
    ProjectsRepository,
    EnvironmentsGateway,
    EnvironmentsRepository,
    TenantsGateway,
    TenantsRepository,
    ModelsGateway,
    ModelsRepository,
    SeedingRepository,
    TemplatesGateway,
    TemplatesRepository,
    FilesGateway,
    FilesRepository,
    LocalFilesGateway,
    LocalFilesRepository,
    EntriesGateway,
    EntriesRepository,
    SeedingGateway,
    SyncLogsGateway,
    SyncLogsRepository,
    JobsGateway,
    JobsRepository,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
