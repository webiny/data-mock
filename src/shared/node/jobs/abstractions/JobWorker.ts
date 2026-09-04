import { createAbstraction } from "@webiny/stdlib";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

export interface IJob {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  config: string | null;
  logs: string | null;
  progress: number | null;
  progressLabel: string | null;
  parentJobId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
}

export interface ICreateJobInput {
  projectId: string;
  type: JobType;
  config?: Record<string, unknown>;
  parentJobId?: string;
}

export interface IListJobsInput {
  projectId: string;
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
