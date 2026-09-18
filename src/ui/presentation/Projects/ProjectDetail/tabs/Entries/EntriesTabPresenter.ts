import { makeAutoObservable, runInAction } from "mobx";
import type { SeedEntry } from "~/shared/types.js";
import { EntriesGateway } from "~/ui/features/entries/abstractions/EntriesGateway.js";
import { EntriesRepository } from "~/ui/features/entries/abstractions/EntriesRepository.js";
import type { EntriesListParams } from "~/ui/features/entries/abstractions/EntriesGateway.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { EntriesTabPresenter as Abstraction } from "./abstractions/EntriesTabPresenter.js";
import type { IEntriesTabVM, IEntryVM } from "./abstractions/EntriesTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "entries";

function toEntryVM(entry: SeedEntry): IEntryVM {
  return {
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
  };
}

class EntriesTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isClearingEntries = false;
  private readonly disposeJobSubscription: () => void;
  private readonly entriesListState: URLListState.Interface;
  private readonly actionConfirmation = new ActionConfirmation();

  public constructor(
    private readonly entriesGateway: EntriesGateway.Interface,
    private readonly entriesRepository: EntriesRepository.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
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
      onChange: this.reloadEntries,
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IEntriesTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const entries = environmentId
      ? this.entriesRepository.getEntriesByEnvironmentId(environmentId)
      : [];
    const models = environmentId
      ? this.modelsRepository.getModelsByEnvironmentId(environmentId)
      : [];
    const tenants = environmentId
      ? this.tenantsRepository.getTenantsByEnvironmentId(environmentId)
      : [];

    return {
      entries: entries.map(toEntryVM),
      entriesTotalCount: environmentId ? this.entriesRepository.totalEntries : 0,
      entriesPage: this.entriesListState.page,
      entriesJobFilter: this.entriesListState.get("jobId") || null,
      entriesModelFilter: this.entriesListState.get("modelId") || null,
      entriesTenantFilter: this.entriesListState.get("tenant") || null,
      entriesStatusFilter: this.entriesListState.get("status") || null,
      models: models.map((model) => ({ modelId: model.modelId, name: model.name })),
      tenants: tenants.map((tenant) => ({ tenantId: tenant.tenantId, name: tenant.name })),
      isLoading: this._isLoading,
      isClearingEntries: this._isClearingEntries,
      clearConfirmation: this.actionConfirmation.vm,
    };
  }

  public activate = async (context: ProjectDetailTabContext): Promise<void> => {
    runInAction(() => {
      this._context = context;
    });
    if (context.ref === null) {
      return;
    }
    if (this._loadedKey === tabContextKey(context) || this._isLoading) {
      return;
    }
    await this.read(context);
  };

  public loadEntriesPage = (page: number): void => {
    this.entriesListState.setPage(page);
  };

  public setEntriesFilter = (key: string, value: string | null): void => {
    this.entriesListState.set(key, value ?? "");
  };

  public clearEntriesFilter = (): void => {
    this.entriesListState.setBatch({ jobId: null, modelId: null, tenant: null, status: null });
  };

  public clearEntries = (): void => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    this.actionConfirmation.request({
      title: "Clear audit log",
      message: "Delete every stored seed entry for this environment? This cannot be undone.",
      confirmLabel: "Clear all",
      run: this.runClearEntries,
    });
  };

  public confirmClearEntries = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelClearEntries = (): void => {
    this.actionConfirmation.cancel();
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
  };

  private runClearEntries = async (): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    this._isClearingEntries = true;
    try {
      const result = await this.entriesGateway.clear(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.entriesRepository.clearEntries(ref.environmentId);
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

  /**
   * A failed read is never marked loaded, so the next activation asks again rather than leaving
   * the tab blank for the rest of the session.
   */
  private read = async (context: ProjectDetailTabContext): Promise<void> => {
    const ref = context.ref;
    if (ref === null) {
      return;
    }
    runInAction(() => {
      this._isLoading = true;
    });
    try {
      const result = await this.entriesGateway.list(ref, this.buildParams());
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.entriesRepository.setEntries(result.value.entries, result.value.total);
        this._loadedKey = tabContextKey(context);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  private buildParams(): EntriesListParams {
    const params: EntriesListParams = { page: this.entriesListState.page };
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

  /**
   * A filter, a page or a clear-filter batch answers with a fresh read, whether or not one is
   * already loaded — dropping it would leave the list showing what the previous filter saw.
   */
  private reloadEntries = (): void => {
    const context = this._context;
    if (context === null) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    void this.read(context);
  };

  /**
   * A job that writes this tab's dataset makes what is on screen stale. The descriptor table is
   * the single source for which job type writes what; a local copy is what drifted before.
   */
  private handleJobStatus = (event: WSJobStatus): void => {
    const context = this._context;
    if (context === null || event.projectId !== context.projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    if (!getJobTypeDatasets(event.type).includes(DATASET)) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    void this.read(context);
  };
}

export const EntriesTabPresenter = Abstraction.createImplementation({
  implementation: EntriesTabPresenterImpl,
  dependencies: [
    EntriesGateway,
    EntriesRepository,
    ModelsRepository,
    TenantsRepository,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
