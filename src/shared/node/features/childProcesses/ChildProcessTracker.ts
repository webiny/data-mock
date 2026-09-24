import path from "node:path";
import { eq } from "drizzle-orm";
import { generateId, Logger } from "@webiny/stdlib";
import { ChildProcessTracker as Abstraction } from "./abstractions/ChildProcessTracker.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { childProcesses } from "~/shared/node/db/schema.js";
import {
  isAlive,
  readProcessCommand,
  readProcessStartedAt,
  terminateProcessGroup,
} from "./processGroup.js";

/** How long a SIGTERM'd group has to exit before it is killed outright. */
const KILL_GRACE_MS = 5000;

/**
 * How far the process's real start time may sit from the one we recorded before we refuse to
 * accept it as ours. `ps` reports whole seconds and the row is written just after spawn, so the
 * true difference is well under a second; the window only has to cover clock skew and a slow boot.
 */
const START_TIME_TOLERANCE_MS = 10_000;

/**
 * Tracks the child processes this server owns, in the database rather than in memory.
 *
 * In-memory tracking is enough while the server lives. It is not enough when the server dies: a
 * `webiny deploy` runs for tens of minutes, so a restart in the middle leaves a pulumi run with no
 * owner, still writing to the stack, while the job row that described it says `interrupted`. The
 * rows here are what the next boot uses to find and stop it.
 */
class ChildProcessTrackerImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public register(input: Abstraction.Input): string {
    const id = generateId();

    this.databaseClient.db
      .insert(childProcesses)
      .values({
        id,
        pid: input.pid,
        ownerPid: process.pid,
        jobId: input.jobId ?? null,
        command: [input.file, ...input.args].join(" "),
        cwd: input.cwd,
        startedAt: Date.now(),
      })
      .run();

    return id;
  }

  public unregister(handle: string): void {
    this.databaseClient.db.delete(childProcesses).where(eq(childProcesses.id, handle)).run();
  }

  /**
   * A row is an orphan only when the process that spawned it is gone. The CLI and the API server
   * share this table, so a server booting while a CLI deploy runs in another terminal would
   * otherwise kill a deploy someone is watching. Those rows are left in place, still owned.
   */
  public async reapOrphans(): Promise<Abstraction.ReapOutput> {
    const rows = this.databaseClient.db.select().from(childProcesses).all();

    let killed = 0;
    let stale = 0;
    let skipped = 0;

    for (const row of rows) {
      if (row.ownerPid !== process.pid && isAlive(row.ownerPid)) {
        skipped++;
        continue;
      }

      if (this.isSameProcess(row)) {
        this.logger.warn(
          `Killing orphaned child process ${row.pid} left by a previous run: ${row.command}`,
        );
        await terminateProcessGroup(row.pid, KILL_GRACE_MS);
        killed++;
      } else {
        stale++;
      }

      this.unregister(row.id);
    }

    return { killed, stale, skipped };
  }

  /** Only this process's own children. Another server's are not ours to stop. */
  public async terminateAll(): Promise<void> {
    const rows = this.databaseClient.db
      .select()
      .from(childProcesses)
      .where(eq(childProcesses.ownerPid, process.pid))
      .all();

    await Promise.all(
      rows.map(async (row) => {
        await terminateProcessGroup(row.pid, KILL_GRACE_MS);
        this.unregister(row.id);
      }),
    );
  }

  /**
   * Decides whether the process holding this pid right now is the one the row describes.
   *
   * A pid is reused once the number space wraps, so a row that survived a long outage can name a
   * process that has nothing to do with us — and killing a stranger's process group is far worse
   * than leaving a pulumi run alone. Two independent facts have to agree: the process started when
   * we said it did, and its argument vector still names the binary we spawned.
   */
  private isSameProcess(row: typeof childProcesses.$inferSelect): boolean {
    const startedAt = readProcessStartedAt(row.pid);
    if (startedAt === null) {
      return false;
    }

    if (Math.abs(startedAt - row.startedAt) > START_TIME_TOLERANCE_MS) {
      return false;
    }

    const command = readProcessCommand(row.pid);
    if (command === null) {
      return false;
    }

    return command.includes(this.identityMarker(row.command));
  }

  /**
   * The part of the recorded command that has to reappear in the live process.
   *
   * The recorded string is not compared whole: `node_modules/.bin/webiny` is an interpreted script,
   * so the kernel rewrites the argument vector to `node <script> <args>` and an equality check
   * would never match. An absolute binary path survives that rewrite; the `yarn webiny` fallback
   * has no path to match on, so the subcommand is used instead.
   */
  private identityMarker(command: string): string {
    const binary = command.split(" ")[0] ?? "";
    return path.isAbsolute(binary) ? binary : "webiny";
  }
}

export const ChildProcessTracker = Abstraction.createImplementation({
  implementation: ChildProcessTrackerImpl,
  dependencies: [DatabaseClient, Logger],
});
