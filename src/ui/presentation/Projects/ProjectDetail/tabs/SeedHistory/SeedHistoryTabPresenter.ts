import { makeAutoObservable, runInAction } from "mobx";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { SeedingRepository } from "~/ui/features/seeding/abstractions/SeedingRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { URLListState } from "~/ui/features/router/abstractions/URLListState.js";
import { navigate } from "~/ui/features/router/Router.js";
import { AppRoutes } from "~/ui/features/router/routePaths.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { SeedHistoryTabPresenter as Abstraction } from "./abstractions/SeedHistoryTabPresenter.js";
import type { ISeedHistoryTabVM } from "./abstractions/SeedHistoryTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "seedJobs";

class SeedHistoryTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private readonly disposeJobSubscription: () => void;
  private readonly seedJobsListState: URLListState.Interface;
  private readonly actionConfirmation = new ActionConfirmation();

  public constructor(
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly seedingRepository: SeedingRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
    urlListStateFactory: URLListStateFactory.Interface,
  ) {
    this.seedJobsListState = urlListStateFactory.create({
      filters: {
        seedStatus: { type: "dropdown" },
      },
      onChange: () => {
        void this.reloadSeedJobs();
      },
    });
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): ISeedHistoryTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const seedJobs = environmentId ? this.seedingRepository.seedJobs : [];

    return {
      seedJobs: seedJobs.map((seedJob) => ({
        id: seedJob.id,
        status: seedJob.status,
        /**
         * Offered on what stopped early. Whether anything is actually left is worked out
         * server-side from the entries the run created, so the button can still be refused.
         */
        resumable: seedJob.status === "cancelled" || seedJob.status === "failed",
        modelCount: seedJob.config.models.length,
        entriesCreated: seedJob.result?.created ?? 0,
        errorCount: seedJob.result?.errors.length ?? 0,
        createdAt: seedJob.createdAt,
      })),
      seedJobsTotalCount: environmentId ? this.seedingRepository.totalSeedJobs : 0,
      seedJobsPage: this.seedJobsListState.page,
      seedJobsStatusFilter: this.seedJobsListState.get("seedStatus") || null,
      isLoading: this._isLoading,
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

  public loadSeedJobsPage = (page: number): void => {
    this.seedJobsListState.setPage(page);
  };

  public setSeedJobsFilter = (key: string, value: string | null): void => {
    this.seedJobsListState.set(key, value ?? "");
  };

  public clearSeedJobsFilter = (): void => {
    this.seedJobsListState.setBatch({ seedStatus: null });
  };

  /**
   * The Entries tab owns its own list state, unreachable from here, so the job id travels as a
   * query parameter on the URL it reads on mount rather than through a shared filter setter.
   */
  public viewJobEntries = (jobId: string): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const path = AppRoutes.environmentTab(context.projectId, context.envName ?? "", "entries");
    navigate(`${path}?jobId=${encodeURIComponent(jobId)}`);
  };

  /**
   * Seeds whatever a run that stopped early did not finish.
   *
   * Confirmed first, like every other action that starts a job, and the remainder is computed
   * server-side: the entries the original run created are real, and re-sending them would
   * duplicate them.
   */
  public resumeSeedJob = (seedJobId: string): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const ref = context.ref;

    this.actionConfirmation.request({
      title: "Resume seeding",
      message:
        "Seeds only what this run did not finish. The entries it already created are left alone.",
      confirmLabel: "Resume",
      run: async () => {
        const result = await this.seedingGateway.resumeSeed(ref, seedJobId);
        if (result.isFail()) {
          this.notifications.error(`Could not resume: ${result.error.message}`);
          return;
        }
        this.notifications.success("Resumed. The remaining entries are being seeded.");
        await this.reloadSeedJobs();
      },
    });
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
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
      const result = await this.seedingGateway.listSeedJobs(ref, this.buildParams());
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.seedingRepository.setSeedJobs(result.value.seedJobs, result.value.total);
        this._loadedKey = tabContextKey(context);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  private buildParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { page: this.seedJobsListState.page };
    const status = this.seedJobsListState.get("seedStatus");
    if (status) {
      params.status = status;
    }
    return params;
  }

  /**
   * Re-reads for a page change, a filter change, a resume or a finished job — none of which is
   * "the same context as before", so this is deliberately not gated on `_loadedKey` the way
   * `activate` is.
   */
  private reloadSeedJobs = async (): Promise<void> => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    await this.read(context);
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
    void this.reloadSeedJobs();
  };
}

export const SeedHistoryTabPresenter = Abstraction.createImplementation({
  implementation: SeedHistoryTabPresenterImpl,
  dependencies: [
    SeedingGateway,
    SeedingRepository,
    NotificationService,
    EventBridge,
    URLListStateFactory,
  ],
});
