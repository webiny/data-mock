import { makeAutoObservable, runInAction } from "mobx";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import type { EnvironmentRef } from "~/shared/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { PullTenantsTabPresenter as Abstraction } from "./abstractions/PullTenantsTabPresenter.js";
import type { IPullTenantsTabVM } from "./abstractions/PullTenantsTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "syncLogs";
/** The sync log type this tab's table is scoped to; the shared dataset also carries other types. */
const LOG_TYPE = "tenants";

class PullTenantsTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isSyncingTenants = false;
  private readonly syncLogsListState: URLListState.Interface;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    urlListStateFactory: URLListStateFactory.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    this.syncLogsListState = urlListStateFactory.create({
      filters: {},
      onChange: () => this.reload(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IPullTenantsTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const syncLogs = environmentId
      ? this.syncLogsRepository
          .getLogsByEnvironmentId(environmentId)
          .filter((log) => log.type === LOG_TYPE)
      : [];

    return {
      syncLogs: syncLogs.map((log) => ({
        id: log.id,
        status: log.status,
        message: log.message,
        request: log.request,
        response: log.response,
        createdAt: log.createdAt,
      })),
      syncLogsTotalCount: environmentId ? this.syncLogsRepository.totalLogs : 0,
      syncLogsPage: this.syncLogsListState.page,
      isLoading: this._isLoading,
      isSyncingTenants: this._isSyncingTenants,
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

  public loadSyncLogsPage = (page: number): void => {
    this.syncLogsListState.setPage(page);
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

  /**
   * Reaches outside this tool to read every tenant off the live system, so it is confirmed first
   * like every other action that starts a job.
   */
  public pullTenants = (): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const ref = context.ref;
    const envLabel = context.envName ?? "this environment";

    this.actionConfirmation.request({
      title: "Pull tenants",
      message:
        `Read every tenant from the live system on ${envLabel} and replace the ` +
        `tenant list stored for this environment?`,
      confirmLabel: "Pull tenants",
      run: () => this.runPullTenants(ref),
    });
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  private runPullTenants = async (ref: EnvironmentRef): Promise<void> => {
    runInAction(() => {
      this._isSyncingTenants = true;
    });
    try {
      const result = await this.tenantsGateway.syncForProject(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Tenant pull job started.");
        } else {
          this.notifications.error(`Failed to start tenant pull: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isSyncingTenants = false;
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

export const PullTenantsTabPresenter = Abstraction.createImplementation({
  implementation: PullTenantsTabPresenterImpl,
  dependencies: [
    SyncLogsGateway,
    SyncLogsRepository,
    TenantsGateway,
    NotificationService,
    URLListStateFactory,
    EventBridge,
  ],
});
