import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ISyncLogVM {
  id: string;
  type: "tenants" | "models" | "upload-file" | "pull-files";
  status: "success" | "error";
  message: string;
  request: unknown;
  response: unknown;
  createdAt: number;
}

export interface IActivityTabVM {
  syncLog: ISyncLogVM[];
  syncLogsTotalCount: number;
  syncLogsPage: number;
  syncLogsTypeFilter: string | null;
  syncLogsStatusFilter: string | null;
  isLoading: boolean;
}

export interface IActivityTabPresenter {
  readonly vm: IActivityTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  deleteSyncLog(logId: string): Promise<void>;
  loadSyncLogsPage(page: number): void;
  setSyncLogsFilter(key: string, value: string | null): void;
  clearSyncLogsFilter(): void;
}

export const ActivityTabPresenter =
  createAbstraction<IActivityTabPresenter>("Ui/ActivityTabPresenter");

export namespace ActivityTabPresenter {
  export type Interface = IActivityTabPresenter;
  export type VM = IActivityTabVM;
}
