import { createAbstraction } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";

export interface IJobsRepository {
  readonly jobs: Job[];
  setJobs(jobs: Job[]): void;
}

export const JobsRepository = createAbstraction<IJobsRepository>("Ui/JobsRepository");

export namespace JobsRepository {
  export type Interface = IJobsRepository;
}
