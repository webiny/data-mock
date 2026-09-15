import { makeAutoObservable, runInAction } from "mobx";
import type { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import type { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import type { SyncPreviewResponse } from "~/shared/responses/sync.js";

export interface ISyncPreviewVM {
  isOpen: boolean;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  preview: SyncPreviewResponse | null;
}

/**
 * The diff a sync is shown as before it runs.
 *
 * A sync rewrites the version, environments and stack output stored for a project from whatever is
 * on disk. That is usually what the user wants, but not always — a checkout on another branch, a
 * half-finished deploy or a stack read through a stale CLI cache all produce a sync that would
 * overwrite good data with worse. Showing what would change first makes storing it a decision
 * rather than the default.
 *
 * Applying re-reads the state rather than replaying the diff. The window between the two is
 * seconds, and replaying a preview would mean storing what was true when the dialog opened rather
 * than what is true when the user accepts it.
 */
export class SyncPreviewState {
  private _projectId: string | null = null;
  private _preview: SyncPreviewResponse | null = null;
  private _isLoading = false;
  private _isApplying = false;
  private _error: string | null = null;

  public constructor(
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  /** The project whose diff is on screen, so a list can show which row the dialog belongs to. */
  public get activeProjectId(): string | null {
    return this._projectId;
  }

  public get vm(): ISyncPreviewVM {
    return {
      isOpen: this._projectId !== null,
      isLoading: this._isLoading,
      isApplying: this._isApplying,
      error: this._error,
      preview: this._preview,
    };
  }

  public open = async (projectId: string): Promise<void> => {
    this._projectId = projectId;
    this._preview = null;
    this._error = null;
    this._isLoading = true;

    const result = await this.environmentsGateway.previewSync(projectId);

    runInAction(() => {
      // The dialog may have been dismissed while the preview was being read.
      if (this._projectId !== projectId) {
        return;
      }
      if (result.isFail()) {
        this._error = result.error.message;
      } else {
        this._preview = result.value;
      }
      this._isLoading = false;
    });
  };

  /** Ignored while the sync is being started, so the dialog cannot be closed mid-request. */
  public close = (): void => {
    if (this._isApplying) {
      return;
    }
    this._projectId = null;
    this._preview = null;
    this._error = null;
    this._isLoading = false;
  };

  public apply = async (): Promise<void> => {
    const projectId = this._projectId;
    if (projectId === null || this._isApplying) {
      return;
    }

    this._isApplying = true;
    try {
      const result = await this.environmentsGateway.sync(projectId);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Sync started.");
          this._projectId = null;
          this._preview = null;
        } else {
          this._error = result.error.message;
          this.notifications.error(`Failed to start sync: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isApplying = false;
      });
    }
  };
}
