import { makeAutoObservable, runInAction } from "mobx";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { syncPreviewJobResultSchema } from "~/shared/responses/sync.js";
import type { EnvironmentsGateway } from "~/ui/features/environments/abstractions/EnvironmentsGateway.js";
import type { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import type { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import type { SyncPreviewJobResult } from "~/shared/responses/sync.js";

/** How often the open dialog asks whether the preview job has finished. */
const POLL_INTERVAL_MS = 1000;

export interface ISyncPreviewVM {
  isOpen: boolean;
  isLoading: boolean;
  isApplying: boolean;
  /** What the preview job is doing right now, when it says. */
  progressLabel: string | null;
  error: string | null;
  result: SyncPreviewJobResult | null;
  /** True when at least one previewed project has something to store. */
  hasChanges: boolean;
}

/**
 * The diff a sync is shown as before it runs.
 *
 * A sync rewrites the version, environments and stack output stored for a project from whatever is
 * on disk. That is usually what the user wants, but not always — a checkout on another branch, a
 * half-finished deploy or a stale CLI cache all produce a sync that would overwrite good data with
 * worse. Showing what would change first makes storing it a decision rather than the default.
 *
 * The read runs as a job, not inline: a project on a remote backend is read by asking the Webiny
 * CLI once per app, which is tens of seconds. This polls the job rather than listening for the
 * websocket event, so a dropped socket shows a slow dialog rather than one that never answers.
 *
 * Applying re-reads rather than replaying the diff. The window between the two is seconds, and
 * replaying a preview would store what was true when the dialog opened rather than what is true
 * when the user accepts it.
 */
export class SyncPreviewState {
  private _projectIds: string[] = [];
  private _jobId: string | null = null;
  private _isOpen = false;
  private _result: SyncPreviewJobResult | null = null;
  private _isLoading = false;
  private _isApplying = false;
  private _progressLabel: string | null = null;
  private _error: string | null = null;
  private _pollTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  public constructor(
    private readonly environmentsGateway: EnvironmentsGateway.Interface,
    private readonly jobsGateway: JobsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
  ) {
    makeAutoObservable(this);
  }

  /** The projects whose diff is on screen, so a list can show which rows the dialog belongs to. */
  public get activeProjectIds(): string[] {
    return this._projectIds;
  }

  public get vm(): ISyncPreviewVM {
    return {
      isOpen: this._isOpen,
      isLoading: this._isLoading,
      isApplying: this._isApplying,
      progressLabel: this._progressLabel,
      error: this._error,
      result: this._result,
      hasChanges: (this._result?.previews ?? []).some((preview) => preview.hasChanges),
    };
  }

  public open = async (projectIds: string[]): Promise<void> => {
    if (projectIds.length === 0) {
      return;
    }

    this.stopPolling();
    this._projectIds = projectIds;
    this._jobId = null;
    this._isOpen = true;
    this._result = null;
    this._error = null;
    this._progressLabel = null;
    this._isLoading = true;

    const started = await this.environmentsGateway.previewSync(projectIds);

    if (started.isFail()) {
      runInAction(() => {
        this._error = started.error.message;
        this._isLoading = false;
      });
      return;
    }

    runInAction(() => {
      this._jobId = started.value.id;
    });

    await this.awaitJob(started.value.id);
  };

  /** Ignored while the sync is being started, so the dialog cannot be closed mid-request. */
  public close = (): void => {
    if (this._isApplying) {
      return;
    }

    /**
     * Stop the read too, not just the watching of it. A preview of a project on a remote backend
     * spends tens of seconds in the Webiny CLI, and nobody is waiting for the answer any more.
     */
    if (this._isLoading && this._jobId !== null) {
      void this.jobsGateway.cancelGlobal(this._jobId);
    }

    this.stopPolling();
    this._isOpen = false;
    this._jobId = null;
    this._projectIds = [];
    this._result = null;
    this._error = null;
    this._progressLabel = null;
    this._isLoading = false;
  };

  /**
   * One sync job per project, not one batch job: each is scoped to its own project, so one failing
   * checkout cannot take the rest of the run down with it.
   */
  public apply = async (): Promise<void> => {
    const projectIds = this.applicableProjectIds;
    if (projectIds.length === 0 || this._isApplying) {
      return;
    }

    this._isApplying = true;
    try {
      const results = await Promise.all(
        projectIds.map((projectId) => this.environmentsGateway.sync(projectId)),
      );
      const failures = results.filter((result) => result.isFail());
      const failed = failures.length;

      runInAction(() => {
        if (failed === results.length) {
          // The dialog stays open carrying the reason: nothing was started, so there is nothing
          // for the user to go and watch instead.
          const first = failures[0];
          const message =
            first !== undefined && first.isFail()
              ? `Sync could not be queued: ${first.error.message}`
              : "Sync could not be queued.";
          this._error = message;
          this.notifications.error(message);
          return;
        }

        if (failed > 0) {
          this.notifications.error(
            `Sync started for ${results.length - failed} project(s); ${failed} could not be queued.`,
          );
        } else {
          this.notifications.success(
            results.length === 1 ? "Sync started." : `Sync started for ${results.length} projects.`,
          );
        }

        this.stopPolling();
        this._isOpen = false;
        this._jobId = null;
        this._projectIds = [];
        this._result = null;
      });
    } finally {
      runInAction(() => {
        this._isApplying = false;
      });
    }
  };

  /** Only the projects that actually have something to store. */
  private get applicableProjectIds(): string[] {
    return (this._result?.previews ?? [])
      .filter((preview) => preview.hasChanges)
      .map((preview) => preview.projectId);
  }

  private awaitJob = async (jobId: string): Promise<void> => {
    const job = await this.jobsGateway.getGlobal(jobId);

    /**
     * The dialog was dismissed, or reopened on another job, while this one was being read. A
     * second click starts a second job, and the slower of the two must not write its answer over
     * the one the user is looking at.
     */
    if (!this._isOpen || this._jobId !== jobId) {
      return;
    }

    if (job.isFail()) {
      runInAction(() => {
        this._error = job.error.message;
        this._isLoading = false;
      });
      return;
    }

    if (!TERMINAL_JOB_STATUSES.has(job.value.status)) {
      runInAction(() => {
        this._progressLabel = job.value.progressLabel;
      });
      this._pollTimer = setTimeout(() => void this.awaitJob(jobId), POLL_INTERVAL_MS);
      return;
    }

    runInAction(() => {
      this._isLoading = false;
      this._progressLabel = null;

      const parsed = syncPreviewJobResultSchema.safeParse(job.value.result);
      if (parsed.success) {
        this._result = parsed.data;
        return;
      }

      // A job that ended without a readable result failed before it could produce one; its own
      // message is the useful thing to show.
      this._error =
        job.value.logs !== null && job.value.logs.trim() !== ""
          ? job.value.logs.trim()
          : `The preview ${job.value.status}.`;
    });
  };

  private stopPolling(): void {
    if (this._pollTimer !== undefined) {
      clearTimeout(this._pollTimer);
      this._pollTimer = undefined;
    }
  }
}
