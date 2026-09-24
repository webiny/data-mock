import { createAbstraction } from "@webiny/stdlib";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface ISeedJobVM {
  id: string;
  status: string;
  /** True for a run that stopped early and still has entries left to create. */
  resumable: boolean;
  modelCount: number;
  entriesCreated: number;
  errorCount: number;
  createdAt: number;
}

export interface ISeedHistoryTabVM {
  seedJobs: ISeedJobVM[];
  seedJobsTotalCount: number;
  seedJobsPage: number;
  seedJobsStatusFilter: string | null;
  isLoading: boolean;
  /** The one dialog standing in front of resuming a run, since that starts a job. */
  confirmation: IActionConfirmationVM;
}

export interface ISeedHistoryTabPresenter {
  readonly vm: ISeedHistoryTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  loadSeedJobsPage(page: number): void;
  setSeedJobsFilter(key: string, value: string | null): void;
  clearSeedJobsFilter(): void;
  /** Navigates to the Entries tab, filtered to the entries this job created. */
  viewJobEntries(jobId: string): void;
  /** Seeds whatever a run that stopped early did not finish. Confirmed first, like every action
   * that starts a job. */
  resumeSeedJob(seedJobId: string): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
  dispose(): void;
}

export const SeedHistoryTabPresenter = createAbstraction<ISeedHistoryTabPresenter>(
  "Ui/SeedHistoryTabPresenter",
);

export namespace SeedHistoryTabPresenter {
  export type Interface = ISeedHistoryTabPresenter;
  export type VM = ISeedHistoryTabVM;
  export type SeedJobVM = ISeedJobVM;
}
