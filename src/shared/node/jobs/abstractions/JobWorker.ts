import { createAbstraction } from "@webiny/stdlib";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

export interface IJob {
  id: string;
  projectId: string | null;
  environmentId: string | null;
  type: JobType;
  status: JobStatus;
  config: string | null;
  logs: string | null;
  /** The job's own answer, parsed. Null for jobs whose effect is the write. */
  result: unknown;
  progress: number | null;
  progressLabel: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface ICreateJobInput {
  projectId: string | null;
  /**
   * Jobs have three scopes: global (neither id), project (projectId only, e.g. sync-system) and
   * environment (both, e.g. seed/deploy/destroy).
   */
  environmentId?: string;
  type: JobType;
  config?: Record<string, unknown>;
}

export interface IListJobsInput {
  projectId?: string;
  environmentId?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export interface IListJobsOutput {
  jobs: IJob[];
  total: number;
}

export interface IJobWorker {
  enqueue(input: ICreateJobInput): Promise<string>;
  getJob(jobId: string): Promise<IJob | null>;
  listJobs(input: IListJobsInput): Promise<IListJobsOutput>;
  processNextJob(): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  drain(): Promise<void>;
  recoverStaleJobs(): Promise<void>;
}

export const JobWorker = createAbstraction<IJobWorker>("Jobs/JobWorker");

export namespace JobWorker {
  export type Interface = IJobWorker;
  export type Job = IJob;
  export type CreateJobInput = ICreateJobInput;
  export type ListJobsInput = IListJobsInput;
  export type ListJobsOutput = IListJobsOutput;
}
