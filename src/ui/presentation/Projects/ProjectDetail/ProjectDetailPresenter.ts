import { makeAutoObservable, runInAction } from "mobx";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import type { IProjectDetailVM, IEditProjectInput } from "./abstractions/ProjectDetailPresenter.js";
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
import type { ModelDiffItem } from "~/shared/responses/models.js";

const VIEW_DATASETS: Record<string, string[]> = {
  tenants: ["tenants"],
  models: ["models"],
  files: ["files"],
  entries: ["entries"],
  history: ["seedJobs"],
  templates: ["templates"],
  "sync-tenants": ["syncLogs"],
  "sync-models": ["syncLogs"],
  seed: ["tenants", "models"],
  import: ["tenants", "models"],
};

const JOB_TYPE_DATASETS: Record<string, string[]> = {
  seed: ["entries", "seedJobs"],
  "sync-tenants": ["tenants", "syncLogs"],
  "sync-models": ["models", "syncLogs"],
  cleanup: ["entries"],
  import: ["entries"],
};

class ProjectDetailPresenterImpl implements Abstraction.Interface {
  private _projectId: string | null = null;
  private _isLoading = false;
  private _isSyncingTenants = false;
  private _isSyncingModels = false;
  private _isPushing = false;
  private _isImporting = false;
  private _isClearingEntries = false;
  private _isCleaningUp = false;
  private _showPushDialog = false;
  private _showEditDialog = false;
  private _showCleanupDialog = false;
  private _isLoadingDiff = false;
  private _modelDiff: ModelDiffItem[] = [];
  private _loadedDatasets = new Set<string>();
  private _loadingDatasets = new Set<string>();
  private _loadingProjectId: string | null = null;
  private _projectHealth: "unknown" | "checking" | "reachable" | "unreachable" = "unknown";
  private _projectHealthError: string | null = null;
  private readonly entriesListState: URLListState.Interface;
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly loadProjectDetailUseCase: LoadProjectDetailUseCase.Interface,
    private readonly deleteTemplateUseCase: DeleteTemplateUseCase.Interface,
    private readonly projectsGateway: ProjectsGateway.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
    private readonly templatesGateway: TemplatesGateway.Interface,
    private readonly templatesRepository: TemplatesRepository.Interface,
    private readonly filesGateway: FilesGateway.Interface,
    private readonly filesRepository: FilesRepository.Interface,
    private readonly entriesGateway: EntriesGateway.Interface,
    private readonly entriesRepository: EntriesRepository.Interface,
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
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
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
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

    const files = this._projectId ? this.filesRepository.getFilesByProjectId(this._projectId) : [];

    const entries = this._projectId
      ? this.entriesRepository.getEntriesByProjectId(this._projectId)
      : [];

    const syncLogs = this._projectId
      ? this.syncLogsRepository.getLogsByProjectId(this._projectId)
      : [];

    return {
      project: project
        ? {
            id: project.id,
            name: project.name,
            apiUrl: project.apiUrl,
            apiToken: project.apiToken,
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
      entriesTotalCount: this._projectId ? this.entriesRepository.totalEntries : 0,
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
      projectHealth: this._projectHealth,
      projectHealthError: this._projectHealthError,
      isLoading: this._isLoading,
      isSyncingTenants: this._isSyncingTenants,
      isSyncingModels: this._isSyncingModels,
      isPushing: this._isPushing,
      isImporting: this._isImporting,
      isClearingEntries: this._isClearingEntries,
      isCleaningUp: this._isCleaningUp,
      showPushDialog: this._showPushDialog,
      showCleanupDialog: this._showCleanupDialog,
      showEditDialog: this._showEditDialog,
      isLoadingDiff: this._isLoadingDiff,
      modelDiff: this._modelDiff,
    };
  }

  public load = async (projectId: string): Promise<void> => {
    if (this._loadingProjectId === projectId || this._projectId === projectId) {
      return;
    }
    this._loadingProjectId = projectId;
    this._projectId = projectId;
    this._loadedDatasets.clear();
    this._loadingDatasets.clear();
    this._isLoading = true;
    try {
      await this.loadProjectDetailUseCase.execute({ projectId });
    } finally {
      runInAction(() => {
        this._loadingProjectId = null;
        this._isLoading = false;
      });
    }
    void this.checkHealth();
  };

  public checkHealth = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._projectHealth = "checking";
    this._projectHealthError = null;
    const result = await this.projectsGateway.healthCheck(this._projectId);
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
    if (!this._projectId) {
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
    if (!this._projectId) {
      return;
    }
    navigate(AppRoutes.projectTab(this._projectId, "entries"));
    this.entriesListState.setBatch({ jobId, modelId: null, tenant: null, status: null });
  };

  public clearEntriesFilter = (): void => {
    this.entriesListState.setBatch({ jobId: null, modelId: null, tenant: null, status: null });
  };

  public loadTemplate = (_templateId: string): void => {
    if (this._projectId) {
      navigate(AppRoutes.seedConfig(this._projectId));
    }
  };

  public deleteTemplate = async (templateId: string): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    await this.deleteTemplateUseCase.execute({ projectId: this._projectId, templateId });
    this.notifications.success("Template deleted.");
  };

  public syncTenants = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._isSyncingTenants = true;
    try {
      const result = await this.tenantsGateway.syncForProject(this._projectId);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Tenant sync job started.");
        } else {
          this.notifications.error(`Failed to start tenant sync: ${result.error.message}`);
        }
        this._isSyncingTenants = false;
      });
    } catch {
      runInAction(() => {
        this._isSyncingTenants = false;
      });
    }
  };

  public syncModels = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._isSyncingModels = true;
    try {
      const result = await this.modelsGateway.syncModels(this._projectId);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Model sync job started.");
        } else {
          this.notifications.error(`Failed to start model sync: ${result.error.message}`);
        }
        this._isSyncingModels = false;
      });
    } catch {
      runInAction(() => {
        this._isSyncingModels = false;
      });
    }
  };

  public openPushDialog = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._showPushDialog = true;
    this._isLoadingDiff = true;
    this._modelDiff = [];
    try {
      const result = await this.modelsGateway.diffModels(this._projectId);
      runInAction(() => {
        if (result.isOk()) {
          this._modelDiff = result.value;
        } else {
          this.notifications.error("Failed to load model diff.");
          this._showPushDialog = false;
        }
      });
    } finally {
      runInAction(() => {
        this._isLoadingDiff = false;
      });
    }
  };

  public closePushDialog = (): void => {
    this._showPushDialog = false;
    this._modelDiff = [];
  };

  public confirmPush = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    this._isPushing = true;
    try {
      const result = await this.modelsGateway.pushModels(this._projectId);
      runInAction(() => {
        if (result.isOk()) {
          const { pushed } = result.value;
          this.notifications.success(
            `Pushed ${pushed.groups} group(s) and ${pushed.models} model(s).`,
          );
        } else {
          this.notifications.error("Failed to push models.");
        }
        this._showPushDialog = false;
        this._modelDiff = [];
      });
    } finally {
      runInAction(() => {
        this._isPushing = false;
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
    if (!this._projectId) {
      return false;
    }
    const result = await this.projectsGateway.update(this._projectId, input);
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
    if (!this._projectId) {
      return;
    }
    this._isClearingEntries = true;
    try {
      const result = await this.entriesGateway.clear(this._projectId);
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
    if (!this._projectId) {
      return;
    }
    const result = await this.filesGateway.remove(this._projectId, fileId);
    if (result.isOk()) {
      this.filesRepository.removeFile(fileId);
      this.notifications.success("File deleted.");
    } else {
      this.notifications.error("Failed to delete file.");
    }
  };

  public deleteSyncLog = async (logId: string): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    const result = await this.syncLogsGateway.remove(this._projectId, logId);
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
    if (!this._projectId) {
      return;
    }
    this._showCleanupDialog = false;
    this._isCleaningUp = true;
    try {
      const result = await this.seedingGateway.cleanupEntries(this._projectId);
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
    if (!this._projectId) {
      return;
    }
    this._isImporting = true;
    try {
      const result = await this.seedingGateway.importEntries(this._projectId, {
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
    const toReload = datasetsToReload.filter((d) => this._loadedDatasets.has(d));
    runInAction(() => {
      for (const dataset of toReload) {
        this._loadedDatasets.delete(dataset);
      }
    });
    void Promise.all(toReload.map((d) => this.loadDataset(d)));
  };

  private reloadEntries = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    const projectId = this._projectId;
    const result = await this.entriesGateway.list(projectId, this.buildEntriesParams());
    runInAction(() => {
      if (result.isOk()) {
        this.entriesRepository.setEntries(result.value.entries, result.value.total);
      }
      this._loadedDatasets.add("entries");
    });
  };

  private loadDataset = async (dataset: string): Promise<void> => {
    if (
      !this._projectId ||
      this._loadedDatasets.has(dataset) ||
      this._loadingDatasets.has(dataset)
    ) {
      return;
    }
    this._loadingDatasets.add(dataset);
    const projectId = this._projectId;

    switch (dataset) {
      case "tenants": {
        const result = await this.tenantsGateway.listForProject(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.tenantsRepository.setTenants(projectId, result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "models": {
        const result = await this.modelsGateway.listModels(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.modelsRepository.setModels(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "files": {
        const result = await this.filesGateway.list(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.filesRepository.setFiles(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "entries": {
        const result = await this.entriesGateway.list(projectId, this.buildEntriesParams());
        runInAction(() => {
          if (result.isOk()) {
            this.entriesRepository.setEntries(result.value.entries, result.value.total);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "seedJobs": {
        const result = await this.seedingGateway.listSeedJobs(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.seedingRepository.setSeedJobs(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "templates": {
        const result = await this.templatesGateway.listForProject(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.templatesRepository.setTemplates(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
      case "syncLogs": {
        const result = await this.syncLogsGateway.list(projectId);
        runInAction(() => {
          if (result.isOk()) {
            this.syncLogsRepository.setLogs(result.value);
          }
          this._loadedDatasets.add(dataset);
        });
        break;
      }
    }
    this._loadingDatasets.delete(dataset);
  };

  private reloadSyncLogs = async (): Promise<void> => {
    if (!this._projectId) {
      return;
    }
    const result = await this.syncLogsGateway.list(this._projectId);
    runInAction(() => {
      if (result.isOk()) {
        this.syncLogsRepository.setLogs(result.value);
      }
    });
  };
}

export const ProjectDetailPresenter = Abstraction.createImplementation({
  implementation: ProjectDetailPresenterImpl,
  dependencies: [
    LoadProjectDetailUseCase,
    DeleteTemplateUseCase,
    ProjectsGateway,
    ProjectsRepository,
    TenantsGateway,
    TenantsRepository,
    ModelsGateway,
    ModelsRepository,
    SeedingRepository,
    TemplatesGateway,
    TemplatesRepository,
    FilesGateway,
    FilesRepository,
    EntriesGateway,
    EntriesRepository,
    SeedingGateway,
    SyncLogsGateway,
    SyncLogsRepository,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
