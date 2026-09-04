import { createAbstraction } from "@webiny/stdlib";
import type { SeedJobStatus } from "~/shared/types.js";

export interface SeedHistoryJobVM {
  id: string;
  status: SeedJobStatus;
  modelCount: number;
  created: number;
  errors: number;
  createdAt: number;
}

export interface SeedHistoryVM {
  jobs: SeedHistoryJobVM[];
  isLoading: boolean;
  isEmpty: boolean;
}

export interface ISeedHistoryPresenter {
  readonly vm: SeedHistoryVM;
  load(projectId: string): Promise<void>;
}

export const SeedHistoryPresenter =
  createAbstraction<ISeedHistoryPresenter>("Ui/SeedHistoryPresenter");

export namespace SeedHistoryPresenter {
  export type Interface = ISeedHistoryPresenter;
  export type VM = SeedHistoryVM;
  export type JobVM = SeedHistoryJobVM;
}
