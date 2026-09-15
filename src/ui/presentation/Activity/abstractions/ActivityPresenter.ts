import { createAbstraction } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";

export interface IActivityVM {
  jobs: Job[];
  totalCount: number;
  page: number;
  typeFilter: string | null;
  statusFilter: string | null;
  isLoading: boolean;
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
  dispose(): void;
}

export const ActivityPresenter = createAbstraction<IActivityPresenter>("Ui/ActivityPresenter");

export namespace ActivityPresenter {
  export type Interface = IActivityPresenter;
  export type VM = IActivityVM;
}
