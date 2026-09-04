import { eq } from "drizzle-orm";
import type { Logger } from "@webiny/stdlib";
import type { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import type { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";
import type { ISetProgressInput } from "./abstractions/JobExecutor.js";
import { jobs } from "~/shared/node/db/schema.js";

const PROGRESS_DB_WRITE_THROTTLE_MS = 1000;
const LOG_DB_FLUSH_INTERVAL_MS = 2000;

export class JobExecutionContext {
  private logLines: string[] = [];
  private logsDirty = false;
  private progressUsed = false;
  private lastProgressDbWriteAt = 0;
  private readonly logFlushTimer: ReturnType<typeof setInterval>;

  public constructor(
    private readonly jobId: string,
    private readonly projectId: string,
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly logger: Logger.Interface,
  ) {
    this.logFlushTimer = setInterval(() => this.flushLogs(), LOG_DB_FLUSH_INTERVAL_MS);
  }

  public appendLog = (line: string): void => {
    this.logLines.push(line);
    this.logsDirty = true;
    this.webSocketBroadcaster.broadcast("job:log", {
      jobId: this.jobId,
      projectId: this.projectId,
      line,
    });
  };

  public setProgress = (input: ISetProgressInput): void => {
    this.progressUsed = true;
    const progressLabel = input.label ?? null;
    this.webSocketBroadcaster.broadcast("job:progress", {
      jobId: this.jobId,
      projectId: this.projectId,
      progress: input.percent,
      progressLabel,
    });
    const now = Date.now();
    if (input.percent >= 100 || now - this.lastProgressDbWriteAt >= PROGRESS_DB_WRITE_THROTTLE_MS) {
      this.lastProgressDbWriteAt = now;
      try {
        this.databaseClient.db
          .update(jobs)
          .set({ progress: input.percent, progressLabel })
          .where(eq(jobs.id, this.jobId))
          .run();
      } catch (error) {
        this.logger.error("Failed to write job progress to database", {
          error: String(error),
        });
      }
    }
  };

  public getLogs(): string {
    return this.logLines.join("\n") + (this.logLines.length > 0 ? "\n" : "");
  }

  public wasProgressUsed(): boolean {
    return this.progressUsed;
  }

  public dispose(): void {
    this.flushLogs();
    clearInterval(this.logFlushTimer);
  }

  private flushLogs(): void {
    if (!this.logsDirty) {
      return;
    }
    this.logsDirty = false;
    try {
      this.databaseClient.db
        .update(jobs)
        .set({ logs: this.getLogs() })
        .where(eq(jobs.id, this.jobId))
        .run();
    } catch (error) {
      this.logger.error("Failed to flush job logs to database", { error: String(error) });
    }
  }
}
