import { createAbstraction } from "@webiny/stdlib";

export interface ProjectItemVM {
  id: string;
  name: string;
  /** Absolute path to the checkout, or null for a remote-only project. */
  rootPath: string | null;
  /**
   * Detected Webiny version. Null for a framework workspace root, where @webiny/cli resolves to
   * "0.0.0" — the UI shows "workspace root" rather than a blank or a fake version.
   */
  webinyVersion: string | null;
  environmentCount: number;
  deployedCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  isSyncingModels: boolean;
}

export interface RemoveConfirmationVM {
  isOpen: boolean;
  projectId: string | null;
  projectName: string | null;
}

export interface ProjectListVM {
  projects: ProjectItemVM[];
  isLoading: boolean;
  isEmpty: boolean;
  removeConfirmation: RemoveConfirmationVM;
}

export interface IProjectListPresenter {
  readonly vm: ProjectListVM;
  load(): Promise<void>;
  /** Rediscovers this project's environments from the Pulumi state on disk. */
  syncProject(projectId: string): Promise<void>;
  remove(id: string): Promise<void>;
  confirmRemove(projectId: string, projectName: string): void;
  cancelRemove(): void;
  executeRemove(): Promise<void>;
}

export const ProjectListPresenter =
  createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
  export type Interface = IProjectListPresenter;
  export type ViewModel = ProjectListVM;
}
