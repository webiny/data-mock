import { createAbstraction } from "@webiny/stdlib";
import type { SeedEntryStatus } from "~/shared/types.js";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface IEntryVM {
  id: string;
  modelId: string;
  tenant: string;
  status: SeedEntryStatus;
  entryId: string;
  entryData: Record<string, unknown>;
  requestData: Record<string, unknown> | null;
  responseData: string | null;
  error: string | null;
  createdAt: number;
}

/** The models available for the filter dropdown, read from whatever the Models tab has stored. */
export interface IEntryModelOptionVM {
  modelId: string;
  name: string;
}

/** The tenants available for the filter dropdown, read from whatever the Tenants tab has stored. */
export interface IEntryTenantOptionVM {
  tenantId: string;
  name: string;
}

export interface IEntriesTabVM {
  entries: IEntryVM[];
  entriesTotalCount: number;
  entriesPage: number;
  entriesJobFilter: string | null;
  entriesModelFilter: string | null;
  entriesTenantFilter: string | null;
  entriesStatusFilter: string | null;
  models: IEntryModelOptionVM[];
  tenants: IEntryTenantOptionVM[];
  isLoading: boolean;
  isClearingEntries: boolean;
  /** The one dialog in front of clearing the log, since that destroys stored data. */
  clearConfirmation: IActionConfirmationVM;
}

export interface IEntriesTabPresenter {
  readonly vm: IEntriesTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  loadEntriesPage(page: number): void;
  setEntriesFilter(key: string, value: string | null): void;
  clearEntriesFilter(): void;
  /** Opens the confirmation before deleting every stored entry for this environment. */
  clearEntries(): void;
  confirmClearEntries(): Promise<void>;
  cancelClearEntries(): void;
  dispose(): void;
}

export const EntriesTabPresenter =
  createAbstraction<IEntriesTabPresenter>("Ui/EntriesTabPresenter");

export namespace EntriesTabPresenter {
  export type Interface = IEntriesTabPresenter;
  export type VM = IEntriesTabVM;
}
