import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IJobsGateway {
  list(projectId: string): Promise<Result<Job[], HTTPError>>;
  get(projectId: string, jobId: string): Promise<Result<Job, HTTPError>>;
  cancel(projectId: string, jobId: string): Promise<Result<Job, HTTPError>>;
}

export const JobsGateway = createAbstraction<IJobsGateway>("Ui/JobsGateway");

export namespace JobsGateway {
  export type Interface = IJobsGateway;
}
