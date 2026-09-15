import { createAbstraction } from "@webiny/stdlib";

import type { ISyncPreviewVM } from "~/ui/presentation/shared/syncPreview/SyncPreviewState.js";

/**
 * Whether a project's environments answer.
 *
 * "no-endpoint" is not a failure: a project that has never been deployed has nothing to reach, and
 * reporting that as unreachable would put a red badge on every fresh checkout.
 */
export type ProjectHealth =
  | "unknown"
  | "checking"
  | "online"
  | "partial"
  | "unreachable"
  | "no-endpoint";

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
  /**
   * Whether any active environment has an API to talk to. Seeding and seed history both address
   * one, so with none there is nothing for those buttons to open.
   */
  seedable: boolean;
  lastSyncedAt: number | null;
  archivedAt: number | null;
  isSyncing: boolean;
  health: ProjectHealth;
  /** "3 of 4 environments online", or why there is nothing to report. */
  healthLabel: string;
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
  /** True while the diff covering every syncable project is being read. */
  isSyncingAll: boolean;
  /** Projects with a checkout on disk. Nothing else can be synced. */
  syncableCount: number;
  archivedProjects: ProjectItemVM[];
  isLoading: boolean;
  isEmpty: boolean;
  /** Why the list is empty, when it is empty because it could not be read. */
  loadError: string | null;
  deleteConfirmation: DeleteConfirmationVM;
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
  /** Enqueues a sync for every project that has a checkout. */
  /** Reads what a sync would change for every project with a checkout, and opens the diff. */
  syncAll(): void;
  /**
   * Re-checks one project's environments. The badge is clickable for exactly this, and a click
   * bypasses the server's ten-minute cache.
   */
  refreshHealth(projectId: string, force?: boolean): Promise<void>;
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
