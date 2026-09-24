import { createAbstraction } from "@webiny/stdlib";
import type { JobSummary } from "./JobsGateway.js";

export interface IJobsRepository {
  readonly jobs: JobSummary[];
  readonly totalJobs: number;
  setJobs(jobs: JobSummary[], total: number): void;
}

export const JobsRepository = createAbstraction<IJobsRepository>("Ui/JobsRepository");

export namespace JobsRepository {
  export type Interface = IJobsRepository;
}
