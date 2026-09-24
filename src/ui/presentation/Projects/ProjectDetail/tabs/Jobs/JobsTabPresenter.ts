import { makeAutoObservable, runInAction } from "mobx";
import type { Job } from "~/shared/types.js";
import { JobsGateway } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import { JobsRepository } from "~/ui/features/jobs/abstractions/JobsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import type { WSJobLog, WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { LiveJobLogs } from "./LiveJobLogs.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { JobsTabPresenter as Abstraction } from "./abstractions/JobsTabPresenter.js";
import type { IJobsTabVM } from "./abstractions/JobsTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "jobs";

class JobsTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  /** The project a read last succeeded for. Jobs is project-scoped, so this is all it keys on. */
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _selectedJob: Job | null = null;
  private _isLoadingSelectedJob = false;
  private readonly jobsListState: URLListState.Interface;
  private readonly liveLogs = new LiveJobLogs();
  private readonly disposeJobSubscription: () => void;
  private readonly disposeJobLogSubscription: () => void;

  public constructor(
    private readonly jobsGateway: JobsGateway.Interface,
    private readonly jobsRepository: JobsRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
    urlListStateFactory: URLListStateFactory.Interface,
  ) {
    this.jobsListState = urlListStateFactory.create({
      filters: {
        jobType: { type: "dropdown" },
        jobStatus: { type: "dropdown" },
      },
      onChange: () => this.reload(),
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
    this.disposeJobLogSubscription = eventBridge.on("job:log", this.handleJobLog);
  }

  public get vm(): IJobsTabVM {
    const projectId = this._context?.projectId ?? null;
    return {
      jobs: projectId ? this.jobsRepository.jobs : [],
      jobsTotalCount: projectId ? this.jobsRepository.totalJobs : 0,
      jobsPage: this.jobsListState.page,
      jobsTypeFilter: this.jobsListState.get("jobType") || null,
      jobsStatusFilter: this.jobsListState.get("jobStatus") || null,
      selectedJob: this._selectedJob,
      isLoadingSelectedJob: this._isLoadingSelectedJob,
    };
  }

  /**
   * Guards on `context.projectId`, never on `context.ref`: the jobs list is project-scoped, and it
   * must load on a project that has no environment at all.
   */
  public activate = async (context: ProjectDetailTabContext): Promise<void> => {
    runInAction(() => {
      this._context = context;
    });
    if (this._loadedKey === context.projectId || this._isLoading) {
      return;
    }
    await this.read(context);
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
    this.disposeJobLogSubscription();
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

  /**
   * Reads one job's detail, log included. The list carries no logs — a deploy streams thousands of
   * Pulumi lines into one, and a page of rows would ship every one to render a table that shows
   * none of them.
   */
  public openJob = async (jobId: string): Promise<void> => {
    const projectId = this._context?.projectId ?? null;
    if (projectId === null) {
      return;
    }

    runInAction(() => {
      this._selectedJob = null;
      this._isLoadingSelectedJob = true;
    });

    const result = await this.jobsGateway.get(projectId, jobId);

    runInAction(() => {
      this._isLoadingSelectedJob = false;
      if (result.isFail()) {
        this.notifications.error(`Could not load the job: ${result.error.message}`);
        return;
      }
      this._selectedJob = result.value;
    });
  };

  public closeJob = (): void => {
    runInAction(() => {
      this._selectedJob = null;
      this._isLoadingSelectedJob = false;
    });
  };

  public cancelJob = async (jobId: string): Promise<void> => {
    const projectId = this._context?.projectId ?? null;
    if (projectId === null) {
      return;
    }
    const result = await this.jobsGateway.cancel(projectId, jobId);
    runInAction(() => {
      if (result.isOk()) {
        this.notifications.success("Job cancelled.");
      } else {
        this.notifications.error(`Failed to cancel job: ${result.error.message}`);
      }
    });
  };

  /**
   * Live log lines for one job, joined for the viewer. Empty until the job emits something, at
   * which point this is what the detail modal shows instead of the stored `logs` column — that one
   * is only flushed every couple of seconds.
   */
  public liveLogsFor = (jobId: string): string => {
    return this.liveLogs.for(jobId);
  };

  private buildParams(): Record<string, string | number> {
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

  /**
   * A failed read is never marked loaded, so the next activation asks again rather than leaving
   * the tab blank for the rest of the session.
   */
  private read = async (context: ProjectDetailTabContext): Promise<void> => {
    runInAction(() => {
      this._isLoading = true;
    });
    try {
      const result = await this.jobsGateway.list(context.projectId, this.buildParams());
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.jobsRepository.setJobs(result.value.jobs, result.value.total);
        this._loadedKey = context.projectId;
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  /** A page or filter change reloads unconditionally — it is an explicit request for other data. */
  private reload = (): void => {
    const context = this._context;
    if (context === null) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    void this.read(context);
  };

  private handleJobLog = (event: WSJobLog): void => {
    const projectId = this._context?.projectId ?? null;
    if (projectId === null || event.projectId !== projectId) {
      return;
    }
    this.liveLogs.append(event.jobId, event.line);
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

export const JobsTabPresenter = Abstraction.createImplementation({
  implementation: JobsTabPresenterImpl,
  dependencies: [
    JobsGateway,
    JobsRepository,
    NotificationService,
    EventBridge,
    URLListStateFactory,
  ],
});
