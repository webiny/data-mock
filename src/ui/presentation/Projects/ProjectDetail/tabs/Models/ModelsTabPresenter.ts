import { makeAutoObservable, runInAction } from "mobx";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { ModelsTabPresenter as Abstraction } from "./abstractions/ModelsTabPresenter.js";
import type { IGroupVM, IModelTenantVM, IModelsTabVM } from "./abstractions/ModelsTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "models";

class ModelsTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _selectedTenant: string | null = null;
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IModelsTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const allModels = environmentId
      ? this.modelsRepository.getModelsByEnvironmentId(environmentId)
      : [];
    const pulledTenants = environmentId
      ? this.tenantsRepository.getTenantsByEnvironmentId(environmentId)
      : [];
    const tenantNames = new Map(pulledTenants.map((tenant) => [tenant.tenantId, tenant.name]));
    for (const model of allModels) {
      if (!tenantNames.has(model.tenant)) {
        tenantNames.set(model.tenant, model.tenant);
      }
    }
    const tenants = Array.from(tenantNames, ([tenantId, name]): IModelTenantVM => ({
      tenantId,
      name,
      modelCount: allModels.filter((model) => model.tenant === tenantId).length,
    }));
    const selectedTenant = this.resolveTenant(tenants.map((tenant) => tenant.tenantId));
    const models = allModels.filter((model) => model.tenant === selectedTenant);

    const groupMap = new Map<string, IGroupVM>();
    for (const model of models) {
      const existing = groupMap.get(model.groupSlug);
      if (existing) {
        existing.modelCount++;
      } else {
        groupMap.set(model.groupSlug, {
          slug: model.groupSlug,
          name: model.groupSlug,
          modelCount: 1,
        });
      }
    }

    return {
      tenants,
      selectedTenant,
      models: models.map((model) => ({
        modelId: model.modelId,
        name: model.name,
        groupSlug: model.groupSlug,
        fieldCount: model.fields.length,
        fields: model.fields,
        syncedAt: model.syncedAt,
      })),
      groups: Array.from(groupMap.values()),
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

  public selectTenant = (tenant: string): void => {
    this._selectedTenant = tenant;
  };

  /** The picked tenant while it still exists, else the environment's own, else the first. */
  private resolveTenant(tenants: string[]): string {
    const defaultTenant = this._context?.tenant ?? "root";
    if (this._selectedTenant !== null && tenants.includes(this._selectedTenant)) {
      return this._selectedTenant;
    }
    if (tenants.includes(defaultTenant) || tenants.length === 0) {
      return defaultTenant;
    }
    return tenants[0]!;
  }

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
      const [result, tenantsResult] = await Promise.all([
        this.modelsGateway.listModels(ref),
        this.tenantsGateway.listForProject(ref),
      ]);
      if (result.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${result.error.message}`);
        return;
      }
      runInAction(() => {
        this.modelsRepository.setModels(result.value);
        // The picker still works from the models' own tenants if the tenant list cannot be read.
        if (tenantsResult.isOk()) {
          this.tenantsRepository.setTenants(ref.environmentId, tenantsResult.value);
        }
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

export const ModelsTabPresenter = Abstraction.createImplementation({
  implementation: ModelsTabPresenterImpl,
  dependencies: [
    ModelsGateway,
    ModelsRepository,
    TenantsGateway,
    TenantsRepository,
    NotificationService,
    EventBridge,
  ],
});
