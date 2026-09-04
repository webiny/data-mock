import { eq } from "drizzle-orm";
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

class JobWorkerImpl implements Abstraction.Interface {
  private readonly controllers = new Map<string, AbortController>();
  private readonly inFlight = new Set<Promise<void>>();
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
        type: input.type,
        status: "pending",
        config: input.config ? JSON.stringify(input.config) : null,
        parentJobId: input.parentJobId ?? null,
        createdAt: Date.now(),
      })
      .run();
    return id;
  }

  public async getJob(jobId: string): Promise<Abstraction.Job | null> {
    return this.queryHelper.getJob(jobId);
  }

  public async listJobs(projectId: string, status?: string): Promise<Abstraction.Job[]> {
    return this.queryHelper.listJobs(projectId, status);
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

  private async processPendingJobs(): Promise<void> {
    const pendingJobs = this.databaseClient.db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .all();

    for (const job of pendingJobs) {
      this.databaseClient.db
        .update(jobs)
        .set({ status: "running", startedAt: Date.now() })
        .where(eq(jobs.id, job.id))
        .run();

      this.webSocketBroadcaster.broadcast("job:status", {
        jobId: job.id,
        projectId: job.projectId,
        type: job.type as JobType,
        status: "running" as JobStatus,
      });

      const promise = this.executeJob(job)
        .catch(() => {})
        .finally(() => this.inFlight.delete(promise));
      this.inFlight.add(promise);
    }
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
    });

    try {
      const executor = this.jobExecutorRegistry.getExecutor(job.type);
      await executor.execute({
        jobId: job.id,
        projectId: job.projectId,
        configJson: job.config,
        appendLog: context.appendLog,
        setProgress: context.setProgress,
        signal: controller.signal,
      });

      context.dispose();
      await this.finishJob(job, controller.signal.aborted ? "cancelled" : "completed", context);
    } catch (error) {
      context.dispose();
      const status: JobStatus = controller.signal.aborted ? "cancelled" : "failed";
      const errorLog = `${context.getLogs()}\nERROR: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
      this.logger.error(`Job ${job.id} (${job.type}) failed`, { error: String(error) });
      await this.finishJobWithLogs(job, status, errorLog, context.wasProgressUsed());
    } finally {
      this.controllers.delete(job.id);
    }
  }

  private async finishJob(
    job: typeof jobs.$inferSelect,
    status: JobStatus,
    context: JobExecutionContextFactory.Context,
  ): Promise<void> {
    await this.finishJobWithLogs(job, status, context.getLogs(), context.wasProgressUsed());
  }

  private async finishJobWithLogs(
    job: typeof jobs.$inferSelect,
    status: JobStatus,
    logs: string,
    progressUsed: boolean,
  ): Promise<void> {
    const updateFields: Record<string, unknown> = {
      status,
      completedAt: Date.now(),
      logs,
    };
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
