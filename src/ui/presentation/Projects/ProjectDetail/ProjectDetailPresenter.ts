import { makeAutoObservable, runInAction } from "mobx";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import type {
  IEnvironmentVM,
  IProjectDetailVM,
  IEditProjectInput,
  IMergedFileVM,
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
import type { EnvironmentRef, ProjectEnvironment, ProjectFile } from "~/shared/types.js";
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
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { JobsRepository } from "~/ui/features/jobs/abstractions/JobsRepository.js";

const VIEW_DATASETS: Record<string, string[]> = {
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

const JOB_TYPE_DATASETS: Record<string, string[]> = {
  seed: ["entries", "seedJobs", "jobs"],
  "pull-tenants": ["tenants", "syncLogs", "jobs"],
  "pull-models": ["models", "syncLogs", "jobs"],
  cleanup: ["entries", "jobs"],
  import: ["entries", "jobs"],
  "upload-files": ["files", "syncLogs", "jobs"],
};

function toEnvironmentVM(environment: ProjectEnvironment): IEnvironmentVM {
  return {
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
  private _isLoading = false;
  private _isSyncingTenants = false;
  private _isSyncingModels = false;
  private _isImporting = false;
  private _isClearingEntries = false;
  private _isCleaningUp = false;
  private _isUploadingGlobal = false;
  private _isPullingFiles = false;
  private _showEditDialog = false;
  private _showCleanupDialog = false;
  private _loadedDatasets = new Set<string>();
  private _loadingDatasets = new Set<string>();
  private _loadingProjectId: string | null = null;
  private _projectHealth: "unknown" | "checking" | "reachable" | "unreachable" = "unknown";
  private _projectHealthError: string | null = null;
  private readonly entriesListState: URLListState.Interface;
  private readonly jobsListState: URLListState.Interface;
  private readonly syncLogsListState: URLListState.Interface;
  private readonly seedJobsListState: URLListState.Interface;
  private readonly disposeJobSubscription: () => void;

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
    urlListStateFactory: URLListStateFactory.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    this.entriesListState = urlListStateFactory.create({
      filters: {
        jobId: { type: "dropdown" },
        modelId: { type: "dropdown" },
        tenant: { type: "dropdown" },
        status: { type: "dropdown" },
      },
      onChange: () => this.reloadEntries(),
    });
    this.jobsListState = urlListStateFactory.create({
      filters: {
        jobType: { type: "dropdown" },
        jobStatus: { type: "dropdown" },
      },
      onChange: () => this.reloadJobs(),
    });
    this.syncLogsListState = urlListStateFactory.create({
      filters: {
        logType: { type: "dropdown" },
        logStatus: { type: "dropdown" },
      },
      onChange: () => this.reloadSyncLogs(),
    });
    this.seedJobsListState = urlListStateFactory.create({
      filters: {
        seedStatus: { type: "dropdown" },
      },
      onChange: () => this.reloadSeedJobs(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IProjectDetailVM {
    const environmentId = this._environmentId;
    const project = this._projectId
      ? (this.projectsRepository.projects.find((p) => p.id === this._projectId) ?? null)
      : null;
    const environmentVMs = (
      this._projectId ? this.environmentsRepository.getEnvironmentsByProjectId(this._projectId) : []
    ).map((environment) => toEnvironmentVM(environment));
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

    return {
      project: project
        ? {
            id: project.id,
            name: project.name,
            rootPath: project.rootPath,
            webinyVersion: project.webinyVersion,
            operationsVersion: project.operationsVersion,
            createdAt: project.createdAt,
          }
        : null,
      environments: environmentVMs,
      currentEnvironment: currentEnvironmentVM,
      showEnvironmentSelector: environmentVMs.length > 1,
      environmentError: this._environmentError,
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
        fields: m.fields,
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
      seedJobsTotalCount: this._projectId ? this.seedingRepository.totalSeedJobs : 0,
      seedJobsPage: this.seedJobsListState.page,
      seedJobsStatusFilter: this.seedJobsListState.get("seedStatus") || null,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        config: t.config,
      })),
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        tenant: f.tenant,
        uploadedAt: f.uploadedAt,
      })),
      mergedFiles,
      entries: entries.map((e) => ({
        id: e.id,
        modelId: e.modelId,
        tenant: e.tenant,
        status: e.status,
        entryId: e.entryId,
        entryData: e.entryData,
        requestData: e.requestData,
        responseData: e.responseData,
        error: e.error,
        createdAt: e.createdAt,
      })),
      entriesTotalCount: environmentId ? this.entriesRepository.totalEntries : 0,
      entriesPage: this.entriesListState.page,
      entriesJobFilter: this.entriesListState.get("jobId") || null,
      entriesModelFilter: this.entriesListState.get("modelId") || null,
      entriesTenantFilter: this.entriesListState.get("tenant") || null,
      entriesStatusFilter: this.entriesListState.get("status") || null,
      syncLog: syncLogs.map((l) => ({
        id: l.id,
        type: l.type,
        status: l.status,
        message: l.message,
        request: l.request,
        response: l.response,
        createdAt: l.createdAt,
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
      isSyncingTenants: this._isSyncingTenants,
      isSyncingModels: this._isSyncingModels,
      isImporting: this._isImporting,
      isClearingEntries: this._isClearingEntries,
      isCleaningUp: this._isCleaningUp,
      isUploadingGlobal: this._isUploadingGlobal,
      isPullingFiles: this._isPullingFiles,
      showCleanupDialog: this._showCleanupDialog,
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
    this._loadedDatasets.clear();
    this._loadingDatasets.clear();
    this._isLoading = true;
    try {
      await this.loadProjectDetailUseCase.execute({ projectId });
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
    const result = await this.environmentsGateway.listForProject(projectId);

    if (result.isFail()) {
      runInAction(() => {
        this._environmentError = result.error.message;
      });
      return;
    }

    const environments = result.value;
    this.environmentsRepository.setEnvironments(projectId, environments);

    const selected =
      envName === null
        ? (environments[0] ?? null)
        : this.environmentsRepository.findByStackName(projectId, envName);

    runInAction(() => {
      if (selected === null) {
        this._environmentId = null;
        this._environmentError =
          environments.length === 0
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

  public activateView = async (view: string): Promise<void> => {
    if (!this.ref) {
      return;
    }
    const datasets = VIEW_DATASETS[view];
    if (!datasets) {
      return;
    }
    const needed = datasets.filter((d) => !this._loadedDatasets.has(d));
    if (needed.length === 0) {
      return;
    }
    await Promise.all(needed.map((d) => this.loadDataset(d)));
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
    await this.deleteTemplateUseCase.execute({ projectId: ref.projectId, templateId });
    this.notifications.success("Template deleted.");
  };

  public pullTenants = async (): Promise<void> => {
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

  public pullModels = async (): Promise<void> => {
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

    await this.reloadFiles();
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

  public importEntries = async (tenant: string, modelIds: string[]): Promise<void> => {
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

  private buildJobsParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { page: this.jobsListState.page };
    const type = this.jobsListState.get("jobType");
    const status = this.jobsListState.get("jobStatus");
    if (type) {
      params.type = type;
    }
    if (status) {
      params.status = status;
    }
    const sort = this.jobsListState.sort;
    if (sort) {
      params.sortField = sort.field;
      params.sortDir = sort.direction;
    }
    return params;
  }

  private buildSeedJobsParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { page: this.seedJobsListState.page };
    const status = this.seedJobsListState.get("seedStatus");
    if (status) {
      params.status = status;
    }
    return params;
  }

  private buildSyncLogsParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { page: this.syncLogsListState.page };
    const type = this.syncLogsListState.get("logType");
    const status = this.syncLogsListState.get("logStatus");
    if (type) {
      params.type = type;
    }
    if (status) {
      params.status = status;
    }
    return params;
  }

  private buildEntriesParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { page: this.entriesListState.page };
    const jobId = this.entriesListState.get("jobId");
    const modelId = this.entriesListState.get("modelId");
    const tenant = this.entriesListState.get("tenant");
    const status = this.entriesListState.get("status");
    if (jobId) {
      params.jobId = jobId;
    }
    if (modelId) {
      params.modelId = modelId;
    }
    if (tenant) {
      params.tenant = tenant;
    }
    if (status) {
      params.status = status;
    }
    return params;
  }

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

  public pullFiles = async (): Promise<void> => {
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
      await this.reloadFiles();
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
  };

  private handleJobStatus = (event: WSJobStatus): void => {
    if (!this._projectId || event.projectId !== this._projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    const datasetsToReload = JOB_TYPE_DATASETS[event.type];
    if (!datasetsToReload) {
      return;
    }
    runInAction(() => {
      for (const dataset of datasetsToReload) {
        this._loadedDatasets.delete(dataset);
        this._loadingDatasets.delete(dataset);
      }
    });
    void Promise.all(datasetsToReload.map((d) => this.loadDataset(d)));
  };

  private reloadEntries = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.entriesGateway.list(ref, this.buildEntriesParams());
    runInAction(() => {
      if (result.isOk()) {
        this.entriesRepository.setEntries(result.value.entries, result.value.total);
      }
      this._loadedDatasets.add("entries");
    });
  };

  private loadDataset = async (dataset: string): Promise<void> => {
    const ref = this.ref;
    if (!ref || this._loadedDatasets.has(dataset) || this._loadingDatasets.has(dataset)) {
      return;
    }
    this._loadingDatasets.add(dataset);

    switch (dataset) {
      case "tenants": {
        const result = await this.tenantsGateway.listForProject(ref);
        runInAction(() => {
          if (result.isOk()) {
            this.tenantsRepository.setTenants(ref.environmentId, result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "models": {
        const result = await this.modelsGateway.listModels(ref);
        runInAction(() => {
          if (result.isOk()) {
            this.modelsRepository.setModels(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "files": {
        const [filesResult, localFilesResult] = await Promise.all([
          this.filesGateway.list(ref),
          this.localFilesGateway.list(),
        ]);
        runInAction(() => {
          if (filesResult.isOk()) {
            this.filesRepository.setFiles(filesResult.value);
          }
          if (localFilesResult.isOk()) {
            this.localFilesRepository.setFiles(localFilesResult.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "entries": {
        const result = await this.entriesGateway.list(ref, this.buildEntriesParams());
        runInAction(() => {
          if (result.isOk()) {
            this.entriesRepository.setEntries(result.value.entries, result.value.total);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "seedJobs": {
        const result = await this.seedingGateway.listSeedJobs(ref, this.buildSeedJobsParams());
        runInAction(() => {
          if (result.isOk()) {
            this.seedingRepository.setSeedJobs(result.value.seedJobs, result.value.total);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "templates": {
        const result = await this.templatesGateway.listForProject(ref.projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.templatesRepository.setTemplates(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "syncLogs": {
        const result = await this.syncLogsGateway.list(ref, this.buildSyncLogsParams());
        runInAction(() => {
          if (result.isOk()) {
            this.syncLogsRepository.setLogs(result.value.logs, result.value.total);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "jobs": {
        const result = await this.jobsGateway.list(ref.projectId, this.buildJobsParams());
        runInAction(() => {
          if (result.isOk()) {
            this.jobsRepository.setJobs(result.value.jobs, result.value.total);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
    }
    this._loadingDatasets.delete(dataset);
  };

  private reloadSeedJobs = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.seedingGateway.listSeedJobs(ref, this.buildSeedJobsParams());
    runInAction(() => {
      if (result.isOk()) {
        this.seedingRepository.setSeedJobs(result.value.seedJobs, result.value.total);
      }
      this._loadedDatasets.add("seedJobs");
    });
  };

  private reloadJobs = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.jobsGateway.list(ref.projectId, this.buildJobsParams());
    runInAction(() => {
      if (result.isOk()) {
        this.jobsRepository.setJobs(result.value.jobs, result.value.total);
      }
      this._loadedDatasets.add("jobs");
    });
  };

  private reloadSyncLogs = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const result = await this.syncLogsGateway.list(ref, this.buildSyncLogsParams());
    runInAction(() => {
      if (result.isOk()) {
        this.syncLogsRepository.setLogs(result.value.logs, result.value.total);
      }
    });
  };

  private reloadFiles = async (): Promise<void> => {
    const ref = this.ref;
    if (!ref) {
      return;
    }
    const [filesResult, localFilesResult] = await Promise.all([
      this.filesGateway.list(ref),
      this.localFilesGateway.list(),
    ]);
    runInAction(() => {
      if (filesResult.isOk()) {
        this.filesRepository.setFiles(filesResult.value);
      }
      if (localFilesResult.isOk()) {
        this.localFilesRepository.setFiles(localFilesResult.value);
      }
      this._loadedDatasets.add("files");
    });
  };

  private currentTenant = (): string => {
    return this.currentEnvironment?.tenant ?? "root";
  };

  private buildMergedFiles = (
    projectFiles: ProjectFile[],
    localFiles: ILocalFileVM[],
  ): IMergedFileVM[] => {
    const projectFileNames = new Set(projectFiles.map((f) => f.fileName));

    const projectMerged: IMergedFileVM[] = projectFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize,
      source: "project",
      thumbnailUrl: f.fileUrl,
      badges: [{ label: "project", color: "blue" }],
    }));

    const globalMerged: IMergedFileVM[] = localFiles
      .filter((f) => !projectFileNames.has(f.fileName))
      .map((f) => ({
        id: f.fileName,
        fileName: f.fileName,
        fileType: f.fileType,
        fileSize: f.fileSize,
        source: "global",
        thumbnailUrl: `/api/files/local/${encodeURIComponent(f.fileName)}/content`,
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
