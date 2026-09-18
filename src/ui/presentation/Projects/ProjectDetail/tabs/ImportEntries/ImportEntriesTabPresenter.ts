import { makeAutoObservable, runInAction } from "mobx";
import type { EnvironmentRef } from "~/shared/types.js";
import { TenantsGateway } from "~/ui/features/tenants/abstractions/TenantsGateway.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { ModelsGateway } from "~/ui/features/models/abstractions/ModelsGateway.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { SeedingGateway } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { ImportEntriesTabPresenter as Abstraction } from "./abstractions/ImportEntriesTabPresenter.js";
import type { IImportEntriesTabVM } from "./abstractions/ImportEntriesTabPresenter.js";

/** The datasets this tab needs: a tenant to import from, and the models to import. */
const DATASETS = ["tenants", "models"];

class ImportEntriesTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isImporting = false;
  private _showCleanupDialog = false;
  private _isCleaningUp = false;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly tenantsGateway: TenantsGateway.Interface,
    private readonly tenantsRepository: TenantsRepository.Interface,
    private readonly modelsGateway: ModelsGateway.Interface,
    private readonly modelsRepository: ModelsRepository.Interface,
    private readonly seedingGateway: SeedingGateway.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IImportEntriesTabVM {
    const environmentId = this._context?.ref?.environmentId ?? null;
    const tenants = environmentId
      ? this.tenantsRepository.getTenantsByEnvironmentId(environmentId)
      : [];
    const models = environmentId
      ? this.modelsRepository.getModelsByEnvironmentId(environmentId)
      : [];

    return {
      tenants: tenants.map((tenant) => ({
        tenantId: tenant.tenantId,
        name: tenant.name,
      })),
      models: models.map((model) => ({
        modelId: model.modelId,
        name: model.name,
      })),
      isLoading: this._isLoading,
      isImporting: this._isImporting,
      confirmation: this.actionConfirmation.vm,
      showCleanupDialog: this._showCleanupDialog,
      isCleaningUp: this._isCleaningUp,
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

  public importEntries = (tenant: string, modelIds: string[]): void => {
    const context = this._context;
    if (context === null || context.ref === null || modelIds.length === 0) {
      return;
    }
    const ref = context.ref;
    const envLabel = context.envName ?? "this environment";

    this.actionConfirmation.request({
      title: "Import entries",
      message:
        `Read every entry of ${modelIds.length} model(s) from tenant "${tenant}" on ` +
        `${envLabel} and store them here?`,
      confirmLabel: "Import entries",
      run: () => this.runImportEntries(ref, tenant, modelIds),
    });
  };

  public confirmImport = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelImport = (): void => {
    this.actionConfirmation.cancel();
  };

  public openCleanupDialog = (): void => {
    this._showCleanupDialog = true;
  };

  public closeCleanupDialog = (): void => {
    this._showCleanupDialog = false;
  };

  public confirmCleanup = async (): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    this._showCleanupDialog = false;
    this._isCleaningUp = true;
    try {
      const result = await this.seedingGateway.cleanupEntries(ref);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Cleanup job started.");
        } else {
          this.notifications.error(`Cleanup failed: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isCleaningUp = false;
      });
    }
  };

  private runImportEntries = async (
    ref: EnvironmentRef,
    tenant: string,
    modelIds: string[],
  ): Promise<void> => {
    this._isImporting = true;
    try {
      const result = await this.seedingGateway.importEntries(ref, {
        tenant,
        models: modelIds,
      });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Import job started.");
        } else {
          this.notifications.error(`Import failed: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isImporting = false;
      });
    }
  };

  /**
   * A failed read is never marked loaded, so the next activation asks again rather than leaving
   * the tab blank for the rest of the session. Reads both datasets this tab needs; either one
   * failing means neither is marked loaded, since the tab needs both to offer an import.
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
      const [tenantsResult, modelsResult] = await Promise.all([
        this.tenantsGateway.listForProject(ref),
        this.modelsGateway.listModels(ref),
      ]);

      let failed = false;
      if (tenantsResult.isFail()) {
        this.notifications.error(`Could not load tenants: ${tenantsResult.error.message}`);
        failed = true;
      }
      if (modelsResult.isFail()) {
        this.notifications.error(`Could not load models: ${modelsResult.error.message}`);
        failed = true;
      }
      if (failed) {
        return;
      }

      runInAction(() => {
        this.tenantsRepository.setTenants(ref.environmentId, tenantsResult.value);
        this.modelsRepository.setModels(modelsResult.value);
        this._loadedKey = tabContextKey(context);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  /**
   * A job that writes either dataset this tab reads makes what is on screen stale. The descriptor
   * table is the single source for which job type writes what; a local copy is what drifted
   * before.
   */
  private handleJobStatus = (event: WSJobStatus): void => {
    const context = this._context;
    if (context === null || event.projectId !== context.projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    const datasets = getJobTypeDatasets(event.type);
    if (!DATASETS.some((dataset) => datasets.includes(dataset))) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    void this.read(context);
  };
}

export const ImportEntriesTabPresenter = Abstraction.createImplementation({
  implementation: ImportEntriesTabPresenterImpl,
  dependencies: [
    TenantsGateway,
    TenantsRepository,
    ModelsGateway,
    ModelsRepository,
    SeedingGateway,
    NotificationService,
    EventBridge,
  ],
});
