import { makeAutoObservable, runInAction } from "mobx";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { ActivityPresenter as Abstraction } from "./abstractions/ActivityPresenter.js";
import type { IActivityVM } from "./abstractions/ActivityPresenter.js";
import type { Job } from "~/shared/types.js";

const PAGE_SIZE = 25;

/**
 * Every job the server has run, whatever project it belongs to.
 *
 * The project's own Jobs tab filters by project id, which leaves the jobs that belong to none —
 * a sync preview, a placeholder-image pull — with nowhere to be seen. They were startable and
 * cancellable but invisible.
 */
class ActivityPresenterImpl implements Abstraction.Interface {
  private _jobs: Job[] = [];
  private _totalCount = 0;
  private _isLoading = false;
  private _error: string | null = null;
  private readonly listState: URLListState.Interface;
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly jobsGateway: JobsGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    private readonly urlListStateFactory: URLListStateFactory.Interface,
    private readonly eventBridge: EventBridge.Interface,
  ) {
    this.listState = urlListStateFactory.create({
      filters: {
        jobType: { type: "dropdown" },
        jobStatus: { type: "dropdown" },
      },
      onChange: () => void this.load(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IActivityVM {
    return {
      jobs: this._jobs,
      totalCount: this._totalCount,
      page: this.listState.page,
      typeFilter: this.listState.get("jobType") || null,
      statusFilter: this.listState.get("jobStatus") || null,
      isLoading: this._isLoading,
      error: this._error,
    };
  }

  public load = async (): Promise<void> => {
    this._isLoading = true;
    this._error = null;

    const result = await this.jobsGateway.listAll({
      page: this.listState.page,
      limit: PAGE_SIZE,
      ...(this.vm.typeFilter !== null ? { type: this.vm.typeFilter } : {}),
      ...(this.vm.statusFilter !== null ? { status: this.vm.statusFilter } : {}),
    });

    runInAction(() => {
      if (result.isFail()) {
        // An empty table and one that could not be read are different answers.
        this._error = result.error.message;
      } else {
        this._jobs = result.value.jobs;
        this._totalCount = result.value.total;
      }
      this._isLoading = false;
    });
  };

  public loadPage = (page: number): void => {
    this.listState.setPage(page);
  };

  public setFilter = (key: string, value: string | null): void => {
    this.listState.set(key, value ?? "");
  };

  public clearFilter = (): void => {
    this.listState.setBatch({ jobType: null, jobStatus: null });
  };

  /**
   * Cancels through the route that does not care which project a job belongs to — the point of
   * this page is the jobs that belong to none.
   */
  public cancelJob = async (jobId: string): Promise<void> => {
    const result = await this.jobsGateway.cancelGlobal(jobId);

    if (result.isFail()) {
      this.notifications.error(`Failed to cancel job: ${result.error.message}`);
      return;
    }

    this.notifications.success("Job cancelled.");
    await this.load();
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
  };

  private handleJobStatus = (event: WSJobStatus): void => {
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    void this.load();
  };
}

export const ActivityPresenter = Abstraction.createImplementation({
  implementation: ActivityPresenterImpl,
  dependencies: [JobsGateway, NotificationService, URLListStateFactory, EventBridge],
});
