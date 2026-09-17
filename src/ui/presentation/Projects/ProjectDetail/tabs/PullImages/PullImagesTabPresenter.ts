import { makeAutoObservable, runInAction } from "mobx";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import { SyncLogsGateway } from "~/ui/features/syncLogs/abstractions/SyncLogsGateway.js";
import { SyncLogsRepository } from "~/ui/features/syncLogs/abstractions/SyncLogsRepository.js";
import { FilesGateway } from "~/ui/features/files/abstractions/FilesGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import type { EnvironmentRef, SyncLogType } from "~/shared/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { PullImagesTabPresenter as Abstraction } from "./abstractions/PullImagesTabPresenter.js";
import type { IPullImagesTabVM } from "./abstractions/PullImagesTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "syncLogs";
/**
 * The sync log types this tab's table is scoped to; the shared dataset also carries other types.
 * The list endpoint filters on a single type, so — as before the split — this tab reads the
 * unfiltered page and narrows it to these two down here.
 */
const IMAGE_LOG_TYPES = new Set<SyncLogType>(["upload-file", "pull-files"]);

class PullImagesTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isPullingFiles = false;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly syncLogsGateway: SyncLogsGateway.Interface,
    private readonly syncLogsRepository: SyncLogsRepository.Interface,
    private readonly filesGateway: FilesGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IPullImagesTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const syncLogs = environmentId
      ? this.syncLogsRepository
          .getLogsByEnvironmentId(environmentId)
          .filter((log) => IMAGE_LOG_TYPES.has(log.type))
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
      isLoading: this._isLoading,
      isPullingFiles: this._isPullingFiles,
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

  /**
   * Reaches outside this tool to download the File Manager's contents, so it is confirmed first
   * like every other action that reaches a live system.
   */
  public pullFiles = (): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const ref = context.ref;
    const envLabel = context.envName ?? "this environment";
    const tenant = context.tenant;

    this.actionConfirmation.request({
      title: "Pull files",
      message: `Download the File Manager contents of tenant "${tenant}" on ${envLabel} into this tool?`,
      confirmLabel: "Pull files",
      run: () => this.runPullFiles(ref, tenant),
    });
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  private runPullFiles = async (ref: EnvironmentRef, tenant: string): Promise<void> => {
    runInAction(() => {
      this._isPullingFiles = true;
    });
    try {
      const result = await this.filesGateway.pullFiles(ref, tenant);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success(`Pulled ${result.value.synced} file(s) from File Manager.`);
        } else {
          this.notifications.error(`Failed to pull files: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isPullingFiles = false;
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
      const result = await this.syncLogsGateway.list(ref);
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

export const PullImagesTabPresenter = Abstraction.createImplementation({
  implementation: PullImagesTabPresenterImpl,
  dependencies: [
    SyncLogsGateway,
    SyncLogsRepository,
    FilesGateway,
    NotificationService,
    EventBridge,
  ],
});
