import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";

/**
 * A job as a list returns it. The log is fetched one job at a time through `get`, because a deploy
 * streams thousands of Pulumi lines into it and a page of rows would carry every one.
 */
export type JobSummary = Omit<Job, "logs">;
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface JobsListParams {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDir?: string;
  type?: string;
  status?: string;
}

export interface JobsListResult {
  jobs: JobSummary[];
  total: number;
}

export interface IJobsGateway {
  list(projectId: string, params?: JobsListParams): Promise<Result<JobsListResult, HTTPError>>;
  /** Every job, including the ones that belong to no project. */
  listAll(params?: JobsListParams): Promise<Result<JobsListResult, HTTPError>>;
  get(projectId: string, jobId: string): Promise<Result<Job, HTTPError>>;
  /** For a job with no project of its own — a sync preview, a placeholder-image pull. */
  getGlobal(jobId: string): Promise<Result<Job, HTTPError>>;
  cancelGlobal(jobId: string): Promise<Result<Job, HTTPError>>;
  cancel(projectId: string, jobId: string): Promise<Result<Job, HTTPError>>;
}

export const JobsGateway = createAbstraction<IJobsGateway>("Ui/JobsGateway");

export namespace JobsGateway {
  export type Interface = IJobsGateway;
}
