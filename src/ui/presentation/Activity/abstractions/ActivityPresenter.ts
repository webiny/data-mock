import { createAbstraction } from "@webiny/stdlib";
import type { JobSummary } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import type { Job } from "~/shared/types.js";

export interface IActivityVM {
  jobs: JobSummary[];
  totalCount: number;
  page: number;
  typeFilter: string | null;
  statusFilter: string | null;
  isLoading: boolean;
  /** The job whose panel is open, with its log. Null while one is being read. */
  selectedJob: Job | null;
  isLoadingSelectedJob: boolean;
  /** Why the list is empty, when it is empty because it could not be read. */
  error: string | null;
}

export interface IActivityPresenter {
  readonly vm: IActivityVM;
  load(): Promise<void>;
  loadPage(page: number): void;
  setFilter(key: string, value: string | null): void;
  clearFilter(): void;
  cancelJob(jobId: string): Promise<void>;
  openJob(jobId: string): Promise<void>;
  closeJob(): void;
  dispose(): void;
}

export const ActivityPresenter = createAbstraction<IActivityPresenter>("Ui/ActivityPresenter");

export namespace ActivityPresenter {
  export type Interface = IActivityPresenter;
  export type VM = IActivityVM;
}
