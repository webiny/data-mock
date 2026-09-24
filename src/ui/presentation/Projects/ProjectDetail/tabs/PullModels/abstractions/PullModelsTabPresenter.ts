import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";

export interface ISyncLogVM {
  id: string;
  type: "tenants" | "models" | "upload-file" | "pull-files";
  status: "success" | "error";
  message: string;
  request: unknown;
  response: unknown;
  createdAt: number;
}

export interface IPullModelsTabVM {
  syncLogs: ISyncLogVM[];
  syncLogsTotalCount: number;
  syncLogsPage: number;
  isLoading: boolean;
  isSyncingModels: boolean;
  /** The one dialog standing in front of every action that starts a job. */
  confirmation: IActionConfirmationVM;
}

export interface IPullModelsTabPresenter {
  readonly vm: IPullModelsTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  deleteSyncLog(logId: string): Promise<void>;
  loadSyncLogsPage(page: number): void;
  /** Opens the confirmation dialog; the pull itself runs from `confirmAction`. */
  pullModels(): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
}

export const PullModelsTabPresenter = createAbstraction<IPullModelsTabPresenter>(
  "Ui/PullModelsTabPresenter",
);

export namespace PullModelsTabPresenter {
  export type Interface = IPullModelsTabPresenter;
  export type VM = IPullModelsTabVM;
}
