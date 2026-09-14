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
  archivedAt: number | null;
  isSyncing: boolean;
  isSyncingModels: boolean;
}

/** One line of the deletion impact, ready to render. Zero counts are left out by the presenter. */
export interface DeletionImpactLineVM {
  label: string;
  count: number;
}

/**
 * Two-step confirmation. `mode` starts at "archive" — the reversible action — and only moves to
 * "purge" when the user explicitly asks for a permanent delete, with the impact counts on screen.
 */
export interface DeleteConfirmationVM {
  isOpen: boolean;
  mode: "archive" | "purge";
  projectId: string | null;
  projectName: string | null;
  isLoadingImpact: boolean;
  /** Rows a purge would destroy. Empty when the project has no data hanging off it. */
  impact: DeletionImpactLineVM[];
  impactTotal: number;
}

export interface ProjectListVM {
  projects: ProjectItemVM[];
  archivedProjects: ProjectItemVM[];
  isLoading: boolean;
  isEmpty: boolean;
  deleteConfirmation: DeleteConfirmationVM;
}

export interface IProjectListPresenter {
  readonly vm: ProjectListVM;
  load(): Promise<void>;
  /** Rediscovers this project's environments from the Pulumi state on disk. */
  syncProject(projectId: string): Promise<void>;
  /** Opens the confirmation in its reversible "archive" mode and loads the impact counts. */
  confirmDelete(projectId: string, projectName: string): void;
  cancelDelete(): void;
  /** Moves the open confirmation to "purge" mode. Does not delete anything on its own. */
  requestPurge(): void;
  archive(): Promise<void>;
  purge(): Promise<void>;
  restore(projectId: string): Promise<void>;
}

export const ProjectListPresenter =
  createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
  export type Interface = IProjectListPresenter;
  export type ViewModel = ProjectListVM;
}
