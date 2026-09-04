import { and, asc, count, desc, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { JobWorker } from "./abstractions/JobWorker.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

const JOB_WAIT_POLL_INTERVAL_MS = 200;

const JOB_SORT_COLUMNS = {
  createdAt: jobs.createdAt,
  type: jobs.type,
  status: jobs.status,
} as const;

type JobSortField = keyof typeof JOB_SORT_COLUMNS;

function isJobSortField(value: string | undefined): value is JobSortField {
  return value !== undefined && Object.hasOwn(JOB_SORT_COLUMNS, value);
}

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

  public async listJobs(input: JobWorker.ListJobsInput): Promise<JobWorker.ListJobsOutput> {
    const conditions: SQL[] = [eq(jobs.projectId, input.projectId)];
    if (input.status !== undefined) {
      conditions.push(eq(jobs.status, input.status));
    }
    if (input.type !== undefined) {
      conditions.push(eq(jobs.type, input.type));
    }
    const whereClause = and(...conditions)!;

    const totalResult = this.databaseClient.db
      .select({ total: count() })
      .from(jobs)
      .where(whereClause)
      .all();
    const total = totalResult[0]?.total ?? 0;

    const sortColumn = isJobSortField(input.sortField)
      ? JOB_SORT_COLUMNS[input.sortField]
      : jobs.createdAt;
    const orderBy = input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const rows = this.databaseClient.db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)
      .all();

    return { jobs: rows.map(toJob), total };
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
