import { createAbstraction } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";

export interface IJobsRepository {
  readonly jobs: Job[];
  readonly totalJobs: number;
  setJobs(jobs: Job[], total: number): void;
}

export const JobsRepository = createAbstraction<IJobsRepository>("Ui/JobsRepository");

export namespace JobsRepository {
  export type Interface = IJobsRepository;
}
