import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";

export interface IJobRecoveryHelperDeps {
  databaseClient: DatabaseClient.Interface;
  controllers: Map<string, AbortController>;
  inFlight: Set<Promise<void>>;
}

export class JobRecoveryHelper {
  private readonly databaseClient: DatabaseClient.Interface;
  private readonly controllers: Map<string, AbortController>;
  private readonly inFlight: Set<Promise<void>>;

  public constructor(deps: IJobRecoveryHelperDeps) {
    this.databaseClient = deps.databaseClient;
    this.controllers = deps.controllers;
    this.inFlight = deps.inFlight;
  }

  public async drain(): Promise<void> {
    await Promise.all(this.inFlight);
  }

  public async cancelJob(jobId: string): Promise<void> {
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
      return;
    }
    this.databaseClient.db
      .update(jobs)
      .set({ status: "cancelled", completedAt: Date.now() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "pending")))
      .run();
  }

  public async recoverStaleJobs(): Promise<void> {
    this.databaseClient.db
      .update(jobs)
      .set({
        status: "interrupted",
        completedAt: Date.now(),
        logs: "Job interrupted by server restart",
      })
      .where(inArray(jobs.status, ["running", "pending"]))
      .run();
  }
}
