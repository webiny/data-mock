import { makeAutoObservable, runInAction } from "mobx";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { TenantsTabPresenter as Abstraction } from "./abstractions/TenantsTabPresenter.js";
import type { ITenantsTabVM } from "./abstractions/TenantsTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "tenants";

class TenantsTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): ITenantsTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const tenants = environmentId
      ? this.tenantsRepository.getTenantsByEnvironmentId(environmentId)
      : [];

    return {
      tenants: tenants.map((tenant) => ({
        tenantId: tenant.tenantId,
        name: tenant.name,
        discoveredAt: tenant.discoveredAt,
      })),
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
      const result = await this.tenantsGateway.listForProject(ref);
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.tenantsRepository.setTenants(ref.environmentId, result.value);
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

export const TenantsTabPresenter = Abstraction.createImplementation({
  implementation: TenantsTabPresenterImpl,
  dependencies: [TenantsGateway, TenantsRepository, NotificationService, EventBridge],
});
