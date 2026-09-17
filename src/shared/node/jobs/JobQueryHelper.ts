import { and, asc, count, desc, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { JobWorker } from "./abstractions/JobWorker.js";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

const JOB_SORT_COLUMNS = {
  createdAt: jobs.createdAt,
  type: jobs.type,
  status: jobs.status,
} as const;

type JobSortField = keyof typeof JOB_SORT_COLUMNS;

function isJobSortField(value: string | undefined): value is JobSortField {
  return value !== undefined && Object.hasOwn(JOB_SORT_COLUMNS, value);
}

/** Every column a list needs. `logs` is deliberately absent — see `IJobSummary`. */
const JOB_SUMMARY_COLUMNS = {
  id: jobs.id,
  projectId: jobs.projectId,
  environmentId: jobs.environmentId,
  type: jobs.type,
  status: jobs.status,
  config: jobs.config,
  result: jobs.result,
  progress: jobs.progress,
  progressLabel: jobs.progressLabel,
  startedAt: jobs.startedAt,
  completedAt: jobs.completedAt,
  createdAt: jobs.createdAt,
} as const;

function toJobSummary(row: {
  [K in keyof typeof JOB_SUMMARY_COLUMNS]: (typeof jobs.$inferSelect)[K];
}): JobWorker.JobSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    environmentId: row.environmentId,
    type: row.type as JobType,
    status: row.status as JobStatus,
    config: row.config,
    result: row.result === null ? null : safeParse(row.result),
    progress: row.progress,
    progressLabel: row.progressLabel,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

function toJob(row: typeof jobs.$inferSelect): JobWorker.Job {
  return {
    id: row.id,
    projectId: row.projectId,
    environmentId: row.environmentId,
    type: row.type as JobType,
    status: row.status as JobStatus,
    config: row.config,
    logs: row.logs,
    result: row.result === null ? null : safeParse(row.result),
    progress: row.progress,
    progressLabel: row.progressLabel,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  };
}

/** A result written by an older build, or hand-edited, must not take the whole job row down. */
function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export class JobQueryHelper {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async getJob(jobId: string): Promise<JobWorker.Job | null> {
    const row = this.databaseClient.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    return row ? toJob(row) : null;
  }

  public async listJobs(input: JobWorker.ListJobsInput): Promise<JobWorker.ListJobsOutput> {
    const conditions: SQL[] = [];
    if (input.environmentId !== undefined) {
      conditions.push(eq(jobs.environmentId, input.environmentId));
    }
    if (input.projectId !== undefined) {
      conditions.push(eq(jobs.projectId, input.projectId));
    }
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
      .select(JOB_SUMMARY_COLUMNS)
      .from(jobs)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)
      .all();

    return { jobs: rows.map(toJobSummary), total };
  }
}
