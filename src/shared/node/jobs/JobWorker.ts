import { and, asc, eq } from "drizzle-orm";
import { generateId, Logger } from "@webiny/stdlib";
import { JobWorker as Abstraction } from "./abstractions/JobWorker.js";
import { JobExecutionContextFactory } from "./abstractions/JobExecutionContextFactory.js";
import { JobExecutorRegistry } from "./abstractions/JobExecutorRegistry.js";
import { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import { JobQueryHelper } from "./JobQueryHelper.js";
import { JobRecoveryHelper } from "./JobRecoveryHelper.js";
import type { JobType, JobStatus } from "~/shared/jobs/constants.js";

const DEFAULT_MAX_CONCURRENT_JOBS = 4;

/**
 * How many jobs may run at once across every project. A deploy holds a child process for tens of
 * minutes, so an unbounded launcher would put every pending row on the machine simultaneously.
 *
 * Read once, at module load, from `MAX_CONCURRENT_JOBS`. Anything that is not a positive number
 * falls back to the default rather than uncapping the launcher.
 */
const MAX_CONCURRENT_JOBS = readMaxConcurrentJobs();

function readMaxConcurrentJobs(): number {
  const configured = Number.parseInt(process.env.MAX_CONCURRENT_JOBS ?? "", 10);
  return Number.isNaN(configured) || configured < 1 ? DEFAULT_MAX_CONCURRENT_JOBS : configured;
}

/** Shown on a job that is queued behind another job for the same project. Cleared on claim. */
const WAITING_LABEL = "waiting: project busy";

class JobWorkerImpl implements Abstraction.Interface {
  private readonly controllers = new Map<string, AbortController>();
  private readonly inFlight = new Set<Promise<void>>();
  /** Projects with a job running right now. Used to serialize per project. */
  private readonly busyProjectIds = new Set<string>();
  private readonly queryHelper: JobQueryHelper;
  private readonly recoveryHelper: JobRecoveryHelper;
  private processing = false;

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly jobExecutorRegistry: JobExecutorRegistry.Interface,
    private readonly executionContextFactory: JobExecutionContextFactory.Interface,
    private readonly logger: Logger.Interface,
  ) {
    this.queryHelper = new JobQueryHelper(databaseClient);
    this.recoveryHelper = new JobRecoveryHelper({
      databaseClient,
      controllers: this.controllers,
      inFlight: this.inFlight,
    });
  }

  public async enqueue(input: Abstraction.CreateJobInput): Promise<string> {
    const id = generateId();
    this.databaseClient.db
      .insert(jobs)
      .values({
        id,
        projectId: input.projectId,
        environmentId: input.environmentId ?? null,
        type: input.type,
        status: "pending",
        config: input.config ? JSON.stringify(input.config) : null,
        createdAt: Date.now(),
      })
      .run();
    return id;
  }

  public async getJob(jobId: string): Promise<Abstraction.Job | null> {
    return this.queryHelper.getJob(jobId);
  }

  public async listJobs(input: Abstraction.ListJobsInput): Promise<Abstraction.ListJobsOutput> {
    return this.queryHelper.listJobs(input);
  }

  public async processNextJob(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      await this.processPendingJobs();
    } finally {
      this.processing = false;
    }
  }

  /**
   * Claims and launches pending jobs under two limits: a global cap, and one running job per
   * project.
   *
   * Per-project serialization is what stops a sync from reading a checkpoint that a
   * deploy is halfway through rewriting. Skipped jobs stay `pending` — there is no third status —
   * and carry a label saying why, so a queued job does not look stuck.
   *
   * `projectId === null` is never blocked: global jobs (pulling placeholder images) belong to no
   * project and would otherwise queue behind whichever project happened to be busy.
   */
  private async processPendingJobs(): Promise<void> {
    // Ordered, because once rows are skipped the natural order becomes rowid luck and a job can
    // sit behind later arrivals indefinitely.
    const pendingJobs = this.databaseClient.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .orderBy(asc(jobs.createdAt))
      .all();

    for (const job of pendingJobs) {
      if (this.inFlight.size >= MAX_CONCURRENT_JOBS) {
        break;
      }

      if (job.projectId !== null && this.busyProjectIds.has(job.projectId)) {
        this.markWaiting(job);
        continue;
      }

      if (!this.claim(job)) {
        continue;
      }

      if (job.projectId !== null) {
        this.busyProjectIds.add(job.projectId);
      }

      this.webSocketBroadcaster.broadcast("job:status", {
        jobId: job.id,
        projectId: job.projectId,
        type: job.type as JobType,
        status: "running" as JobStatus,
      });

      const projectId = job.projectId;
      const promise = this.executeJob(job)
        .catch(() => {})
        .finally(() => {
          this.inFlight.delete(promise);
          if (projectId !== null) {
            this.busyProjectIds.delete(projectId);
          }
        });
      this.inFlight.add(promise);
    }
  }

  /**
   * Flips one row to `running`, guarded on it still being `pending`.
   *
   * The guard matters because `recoverStaleJobs` and `cancelJob` write the same rows: an
   * unguarded update would resurrect a job that was cancelled between the select and the claim.
   * `progressLabel` is cleared here rather than at completion — `finishJobWithLogs` only nulls it
   * when `setProgress` was used, so a waiting label on a job that never reports progress would
   * survive the whole run.
   */
  private claim(job: typeof jobs.$inferSelect): boolean {
    const result = this.databaseClient.db
      .update(jobs)
      .set({ status: "running", startedAt: Date.now(), progressLabel: null })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
      .run();

    return result.changes > 0;
  }

  private markWaiting(job: typeof jobs.$inferSelect): void {
    if (job.progressLabel === WAITING_LABEL) {
      return;
    }

    this.databaseClient.db
      .update(jobs)
      .set({ progressLabel: WAITING_LABEL })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "pending")))
      .run();
  }

  public async cancelJob(jobId: string): Promise<void> {
    await this.recoveryHelper.cancelJob(jobId);
  }

  public async drain(): Promise<void> {
    await this.recoveryHelper.drain();
  }

  public async recoverStaleJobs(): Promise<void> {
    await this.recoveryHelper.recoverStaleJobs();
  }

  private async executeJob(job: typeof jobs.$inferSelect): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    const context = this.executionContextFactory.create({
      jobId: job.id,
      projectId: job.projectId,
      environmentId: job.environmentId,
    });

    try {
      const executor = this.jobExecutorRegistry.getExecutor(job.type);
      await executor.execute({
        jobId: job.id,
        projectId: job.projectId,
        environmentId: job.environmentId,
        configJson: job.config,
        appendLog: context.appendLog,
        setProgress: context.setProgress,
        setResult: context.setResult,
        signal: controller.signal,
      });

      context.dispose();
      await this.finishJob(job, controller.signal.aborted ? "cancelled" : "completed", context);
    } catch (error) {
      context.dispose();
      const status: JobStatus = controller.signal.aborted ? "cancelled" : "failed";
      const errorLog = `${context.getLogs()}\nERROR: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
      this.logger.error(`Job ${job.id} (${job.type}) failed`, { error: String(error) });
      await this.finishJobWithLogs(
        job,
        status,
        errorLog,
        context.wasProgressUsed(),
        context.getResult(),
      );
    } finally {
      this.controllers.delete(job.id);
    }
  }

  private async finishJob(
    job: typeof jobs.$inferSelect,
    status: JobStatus,
    context: JobExecutionContextFactory.Context,
  ): Promise<void> {
    await this.finishJobWithLogs(
      job,
      status,
      context.getLogs(),
      context.wasProgressUsed(),
      context.getResult(),
    );
  }

  private async finishJobWithLogs(
    job: typeof jobs.$inferSelect,
    status: JobStatus,
    logs: string,
    progressUsed: boolean,
    result: string | null = null,
  ): Promise<void> {
    const updateFields: Record<string, unknown> = {
      status,
      completedAt: Date.now(),
      logs,
    };
    /**
     * Written only when the executor produced one. A failed run keeps whatever partial result it
     * managed to set rather than having it blanked on the way out.
     */
    if (result !== null) {
      updateFields["result"] = result;
    }
    if (progressUsed) {
      updateFields["progress"] = 100;
      updateFields["progressLabel"] = null;
    }
    this.databaseClient.db.update(jobs).set(updateFields).where(eq(jobs.id, job.id)).run();

    this.webSocketBroadcaster.broadcast("job:status", {
      jobId: job.id,
      projectId: job.projectId,
      type: job.type as JobType,
      status,
    });
  }
}

export const JobWorker = Abstraction.createImplementation({
  implementation: JobWorkerImpl,
  dependencies: [
    DatabaseClient,
    WebSocketBroadcaster,
    JobExecutorRegistry,
    JobExecutionContextFactory,
    Logger,
  ],
});
