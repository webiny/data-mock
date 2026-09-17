import { createAbstraction } from "@webiny/stdlib";
import type { Job } from "~/shared/types.js";
import type { JobSummary } from "~/ui/features/jobs/abstractions/JobsGateway.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";

export interface IJobsTabVM {
  jobs: JobSummary[];
  jobsTotalCount: number;
  jobsPage: number;
  jobsTypeFilter: string | null;
  jobsStatusFilter: string | null;
  /**
   * The job whose panel is open, with its log. Fetched one at a time rather than carried on every
   * list row — a deploy streams thousands of Pulumi lines into a log the table never shows.
   */
  selectedJob: Job | null;
  isLoadingSelectedJob: boolean;
}

export interface IJobsTabPresenter {
  readonly vm: IJobsTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes.
   *
   * Jobs is project-scoped, not environment-scoped: it reads as soon as `context.projectId` is
   * known, on a project that has no environment at all. It never waits on `context.ref`.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  loadJobsPage(page: number): void;
  setJobsFilter(key: string, value: string | null): void;
  clearJobsFilter(): void;
  openJob(jobId: string): Promise<void>;
  closeJob(): void;
  cancelJob(jobId: string): Promise<void>;
  /** Live log tail for a running job. Empty until the job emits something. */
  liveLogsFor(jobId: string): string;
}

export const JobsTabPresenter = createAbstraction<IJobsTabPresenter>("Ui/JobsTabPresenter");

export namespace JobsTabPresenter {
  export type Interface = IJobsTabPresenter;
  export type VM = IJobsTabVM;
}
