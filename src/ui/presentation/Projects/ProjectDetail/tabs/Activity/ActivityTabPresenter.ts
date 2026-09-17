import { makeAutoObservable, runInAction } from "mobx";
import { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { ActivityTabPresenter as Abstraction } from "./abstractions/ActivityTabPresenter.js";
import type { IActivityTabVM } from "./abstractions/ActivityTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "syncLogs";

class ActivityTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private readonly syncLogsListState: URLListState.Interface;
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    urlListStateFactory: URLListStateFactory.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    this.syncLogsListState = urlListStateFactory.create({
      filters: {
        logType: { type: "dropdown" },
        logStatus: { type: "dropdown" },
      },
      onChange: () => this.reload(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IActivityTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const syncLogs = environmentId
      ? this.syncLogsRepository.getLogsByEnvironmentId(environmentId)
      : [];

    return {
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
      isLoading: this._isLoading,
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

  public dispose = (): void => {
    this.disposeJobSubscription();
  };

  public deleteSyncLog = async (logId: string): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const result = await this.syncLogsGateway.remove(ref, logId);
    if (result.isOk()) {
      runInAction(() => {
        this.syncLogsRepository.removeLog(logId);
      });
      this.notifications.success("Sync log deleted.");
    } else {
      this.notifications.error("Failed to delete sync log.");
    }
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

  private buildParams(): Record<string, string | number> {
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

  /**
   * A filter or page change makes what is on screen stale, whether or not the tab counts as
   * loaded. Mirrors `ProjectDatasets.reload`, which is deliberately not gated on a read in flight.
   */
  private reload = (): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    void this.read(context);
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
      const result = await this.syncLogsGateway.list(ref, this.buildParams());
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.syncLogsRepository.setLogs(result.value.logs, result.value.total);
        this._loadedKey = tabContextKey(context);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
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

export const ActivityTabPresenter = Abstraction.createImplementation({
  implementation: ActivityTabPresenterImpl,
  dependencies: [
    SyncLogsGateway,
    SyncLogsRepository,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
