import { createAbstraction } from "@webiny/stdlib";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface IImportTenantVM {
  tenantId: string;
  name: string;
}

export interface IImportModelVM {
  modelId: string;
  name: string;
}

export interface IImportEntriesTabVM {
  tenants: IImportTenantVM[];
  /** Empty only while there are no tenants. */
  selectedTenant: string;
  /** The selected tenant's models: each tenant has its own. */
  models: IImportModelVM[];
  isLoading: boolean;
  /** True while an import job is being started, after the confirmation was accepted. */
  isImporting: boolean;
  /** Confirmation shown before an import job starts — this tab's own dialog. */
  confirmation: IActionConfirmationVM;
  showCleanupDialog: boolean;
  isCleaningUp: boolean;
}

export interface IImportEntriesTabPresenter {
  readonly vm: IImportEntriesTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  selectTenant(tenant: string): void;
  /** Opens the confirmation dialog; the import job starts only once it is accepted. */
  importEntries(tenant: string, modelIds: string[]): void;
  confirmImport(): Promise<void>;
  cancelImport(): void;
  openCleanupDialog(): void;
  closeCleanupDialog(): void;
  confirmCleanup(): Promise<void>;
}

export const ImportEntriesTabPresenter = createAbstraction<IImportEntriesTabPresenter>(
  "Ui/ImportEntriesTabPresenter",
);

export namespace ImportEntriesTabPresenter {
  export type Interface = IImportEntriesTabPresenter;
  export type VM = IImportEntriesTabVM;
}
