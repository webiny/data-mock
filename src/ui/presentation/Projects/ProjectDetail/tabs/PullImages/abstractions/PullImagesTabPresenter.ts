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

export interface IPullImagesTabVM {
  syncLogs: ISyncLogVM[];
  isLoading: boolean;
  /** True while a file pull is running. */
  isPullingFiles: boolean;
  /** The one dialog standing in front of a pull, since that reaches a live system. */
  confirmation: IActionConfirmationVM;
}

export interface IPullImagesTabPresenter {
  readonly vm: IPullImagesTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  deleteSyncLog(logId: string): Promise<void>;
  /** Asks for confirmation before pulling files from the live File Manager. */
  pullFiles(): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
}

export const PullImagesTabPresenter = createAbstraction<IPullImagesTabPresenter>(
  "Ui/PullImagesTabPresenter",
);

export namespace PullImagesTabPresenter {
  export type Interface = IPullImagesTabPresenter;
  export type VM = IPullImagesTabVM;
  export type SyncLogVM = ISyncLogVM;
}
