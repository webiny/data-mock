import { and, eq } from "drizzle-orm";
import type { JobWorker } from "./abstractions/JobWorker.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

const JOB_WAIT_POLL_INTERVAL_MS = 200;

function toJob(row: typeof jobs.$inferSelect): JobWorker.Job {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as JobType,
    status: row.status as JobStatus,
    config: row.config,
    logs: row.logs,
    progress: row.progress,
    progressLabel: row.progressLabel,
    parentJobId: row.parentJobId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

export class JobQueryHelper {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async getJob(jobId: string): Promise<JobWorker.Job | null> {
    const row = this.databaseClient.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    return row ? toJob(row) : null;
  }

  public async listJobs(projectId: string, status?: string): Promise<JobWorker.Job[]> {
    const condition =
      status !== undefined
        ? and(eq(jobs.projectId, projectId), eq(jobs.status, status))
        : eq(jobs.projectId, projectId);
    return this.databaseClient.db.select().from(jobs).where(condition).all().map(toJob);
  }

  public async waitForJob(jobId: string, signal?: AbortSignal): Promise<JobWorker.Job> {
    while (true) {
      if (signal?.aborted) {
        throw new Error("Job wait aborted");
      }
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }
      if (TERMINAL_JOB_STATUSES.has(job.status)) {
        return job;
      }
      await new Promise<void>((resolve, reject) => {
        let onAbort: (() => void) | undefined;
        const timer = setTimeout(() => {
          if (signal && onAbort) {
            signal.removeEventListener("abort", onAbort);
          }
          resolve();
        }, JOB_WAIT_POLL_INTERVAL_MS);
        if (signal) {
          onAbort = (): void => {
            clearTimeout(timer);
            reject(new Error("Job wait aborted"));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  }
}
