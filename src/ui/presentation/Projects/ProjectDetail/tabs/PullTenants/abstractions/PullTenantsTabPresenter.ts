import { createAbstraction } from "@webiny/stdlib";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ISyncLogVM {
  id: string;
  status: "success" | "error";
  message: string;
  request: unknown;
  response: unknown;
  createdAt: number;
}

export interface IPullTenantsTabVM {
  syncLogs: ISyncLogVM[];
  syncLogsTotalCount: number;
  syncLogsPage: number;
  isLoading: boolean;
  /** True while a tenant pull job is being started. */
  isSyncingTenants: boolean;
  /** The one dialog standing in front of a pull, since that starts a job. */
  confirmation: IActionConfirmationVM;
}

export interface IPullTenantsTabPresenter {
  readonly vm: IPullTenantsTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  loadSyncLogsPage(page: number): void;
  deleteSyncLog(logId: string): Promise<void>;
  /** Asks for confirmation before pulling tenants from the live system, since that starts a job. */
  pullTenants(): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
}

export const PullTenantsTabPresenter = createAbstraction<IPullTenantsTabPresenter>(
  "Ui/PullTenantsTabPresenter",
);

export namespace PullTenantsTabPresenter {
  export type Interface = IPullTenantsTabPresenter;
  export type VM = IPullTenantsTabVM;
  export type SyncLogVM = ISyncLogVM;
}
