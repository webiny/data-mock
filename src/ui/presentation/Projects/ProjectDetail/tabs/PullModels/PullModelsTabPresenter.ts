import { makeAutoObservable, runInAction } from "mobx";
import { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { PullModelsTabPresenter as Abstraction } from "./abstractions/PullModelsTabPresenter.js";
import type { IPullModelsTabVM } from "./abstractions/PullModelsTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "syncLogs";
/** The only sync log type this tab is responsible for showing. */
const LOG_TYPE = "models";

class PullModelsTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isSyncingModels = false;
  private readonly syncLogsListState: URLListState.Interface;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    urlListStateFactory: URLListStateFactory.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    this.syncLogsListState = urlListStateFactory.create({
      filters: {},
      onChange: () => this.reread(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IPullModelsTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const syncLogs = environmentId
      ? this.syncLogsRepository.getLogsByEnvironmentId(environmentId)
      : [];

    return {
      syncLogs: syncLogs
        .filter((log) => log.type === LOG_TYPE)
        .map((log) => ({
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
      isLoading: this._isLoading,
      isSyncingModels: this._isSyncingModels,
      confirmation: this.actionConfirmation.vm,
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

  public pullModels = (): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const stackName = context.envName ?? "";

    this.actionConfirmation.request({
      title: "Pull models",
      message:
        `Read every content model from the live system on ${stackName} and replace the ` +
        `models stored for this environment?`,
      confirmLabel: "Pull models",
      run: this.runPullModels,
    });
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  private runPullModels = async (): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    runInAction(() => {
      this._isSyncingModels = true;
    });
    try {
      const result = await this.modelsGateway.pullModels(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Model pull job started.");
        } else {
          this.notifications.error(`Failed to start model pull: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isSyncingModels = false;
      });
    }
  };

  private buildParams(): Record<string, string | number> {
    return { page: this.syncLogsListState.page, type: LOG_TYPE };
  }

  /**
   * A page change makes what is on screen stale, whether or not the tab counts as loaded. Mirrors
   * `ProjectDatasets.reload`, which is deliberately not gated on a read in flight.
   */
  private reread = (): void => {
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

export const PullModelsTabPresenter = Abstraction.createImplementation({
  implementation: PullModelsTabPresenterImpl,
  dependencies: [
    SyncLogsGateway,
    SyncLogsRepository,
    ModelsGateway,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
