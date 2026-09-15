import { createAbstraction } from "@webiny/stdlib";

import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { ISyncPreviewVM } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";

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
  /** False for a remote-only project, which has nothing on disk to sync. */
  syncable: boolean;
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
  /** True while every syncable project is being enqueued. */
  isSyncingAll: boolean;
  /** Projects with a checkout on disk. Nothing else can be synced. */
  syncableCount: number;
  archivedProjects: ProjectItemVM[];
  isLoading: boolean;
  isEmpty: boolean;
  deleteConfirmation: DeleteConfirmationVM;
  /** The one dialog standing in front of every action that starts a job. */
  confirmation: IActionConfirmationVM;
  /** What a sync from disk would change. Shown before anything is stored. */
  syncPreview: ISyncPreviewVM;
}

export interface IProjectListPresenter {
  readonly vm: ProjectListVM;
  load(): Promise<void>;
  /**
   * Reads what a sync from disk would change and opens the diff. Nothing is stored until
   * `applySync`.
   */
  syncProject(projectId: string): void;
  applySync(): Promise<void>;
  closeSyncPreview(): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
  /** Enqueues a sync for every project that has a checkout. */
  syncAll(): void;
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
