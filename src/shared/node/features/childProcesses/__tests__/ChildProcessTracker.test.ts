import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ChildProcessTracker } from "../abstractions/ChildProcessTracker.js";
import { isAlive } from "../processGroup.js";
import { childProcesses } from "~/shared/node/db/schema.js";

/** A process that never exits on its own, in its own group — what a real deploy child looks like. */
const IDLE_SCRIPT = "setInterval(() => {}, 1000)";

/** Spawns an idle process, and one child under it, printing the child's pid. */
const NESTED_SCRIPT = `
const { spawn } = require("node:child_process");
const child = spawn(process.execPath, ["-e", ${JSON.stringify(IDLE_SCRIPT)}], { stdio: "ignore" });
process.stdout.write(String(child.pid));
setInterval(() => {}, 1000);
`;

describe("ChildProcessTracker", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let spawned: ChildProcess[];

  beforeEach(() => {
    tc = createTestContainer();
    spawned = [];
  });

  afterEach(async () => {
    for (const child of spawned) {
      if (child.pid !== undefined) {
        killGroupQuietly(child.pid);
      }
    }
    tc.cleanup();
  });

  function spawnIdle(script = IDLE_SCRIPT): ChildProcess {
    const child = spawn(process.execPath, ["-e", script], { detached: true, stdio: "pipe" });
    spawned.push(child);
    return child;
  }

  function trackerRows(): (typeof childProcesses.$inferSelect)[] {
    return tc.databaseClient.db.select().from(childProcesses).all();
  }

  function registerSpawned(child: ChildProcess, script = IDLE_SCRIPT): string {
    const tracker = tc.container.resolve(ChildProcessTracker);
    return tracker.register({
      pid: child.pid as number,
      file: process.execPath,
      args: ["-e", script],
      cwd: process.cwd(),
    });
  }

  it("records a live child and forgets it again", () => {
    const tracker = tc.container.resolve(ChildProcessTracker);
    const child = spawnIdle();

    const handle = registerSpawned(child);

    const rows = trackerRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pid).toBe(child.pid);
    expect(rows[0]?.ownerPid).toBe(process.pid);

    tracker.unregister(handle);
    expect(trackerRows()).toHaveLength(0);
  });

  it("kills a child left behind by a previous run, and drops its row", async () => {
    const tracker = tc.container.resolve(ChildProcessTracker);
    const child = spawnIdle();
    registerSpawned(child);

    const result = await tracker.reapOrphans();

    expect(result.killed).toBe(1);
    expect(await hasExited(child.pid as number)).toBe(true);
    expect(trackerRows()).toHaveLength(0);
  });

  it("kills the whole process group, not just the process it recorded", async () => {
    // webiny is a launcher: the run that holds the stack is pulumi, spawned underneath it. A reap
    // that only signals the recorded pid leaves that running.
    const parent = spawnIdle(NESTED_SCRIPT);
    const grandchildPid = await readFirstOutput(parent);
    registerSpawned(parent, NESTED_SCRIPT);

    const tracker = tc.container.resolve(ChildProcessTracker);
    await tracker.reapOrphans();

    expect(await hasExited(grandchildPid)).toBe(true);
  });

  it("leaves a child alone while the process that spawned it is still running", async () => {
    // The CLI and the API server share this table. A server booting while a CLI deploy runs in
    // another terminal must not kill it.
    const child = spawnIdle();
    tc.databaseClient.db
      .insert(childProcesses)
      .values({
        id: generateId(),
        pid: child.pid as number,
        // pid 1 is always alive and is never this process.
        ownerPid: 1,
        jobId: null,
        command: `${process.execPath} -e ${IDLE_SCRIPT}`,
        cwd: process.cwd(),
        startedAt: Date.now(),
      })
      .run();

    const tracker = tc.container.resolve(ChildProcessTracker);
    const result = await tracker.reapOrphans();

    expect(result.skipped).toBe(1);
    expect(result.killed).toBe(0);
    expect(isAlive(child.pid as number)).toBe(true);
    // The row stays: it is still owned, and the owner may still need to stop it.
    expect(trackerRows()).toHaveLength(1);
  });

  it("does not kill a process that merely inherited the pid", async () => {
    const child = spawnIdle();
    const handle = registerSpawned(child);

    // A pid is reused once the number space wraps. Backdating the row is what that looks like from
    // the reaper's side: same pid, a process that started at a completely different time.
    tc.databaseClient.db
      .update(childProcesses)
      .set({ startedAt: Date.now() - 48 * 60 * 60 * 1000 })
      .where(eq(childProcesses.id, handle))
      .run();

    const tracker = tc.container.resolve(ChildProcessTracker);
    const result = await tracker.reapOrphans();

    expect(result.killed).toBe(0);
    expect(result.stale).toBe(1);
    expect(isAlive(child.pid as number)).toBe(true);
    expect(trackerRows()).toHaveLength(0);
  });

  it("does not kill a pid whose command no longer matches what was spawned", async () => {
    const child = spawnIdle();
    tc.databaseClient.db
      .insert(childProcesses)
      .values({
        id: generateId(),
        pid: child.pid as number,
        ownerPid: process.pid,
        jobId: null,
        command: "/definitely/not/this/binary deploy api",
        cwd: process.cwd(),
        startedAt: Date.now(),
      })
      .run();

    const tracker = tc.container.resolve(ChildProcessTracker);
    const result = await tracker.reapOrphans();

    expect(result.killed).toBe(0);
    expect(result.stale).toBe(1);
    expect(isAlive(child.pid as number)).toBe(true);
  });

  it("drops the row of a child that had already exited", async () => {
    const child = spawnIdle();
    const pid = child.pid as number;
    registerSpawned(child);
    killGroupQuietly(pid);
    await hasExited(pid);

    const tracker = tc.container.resolve(ChildProcessTracker);
    const result = await tracker.reapOrphans();

    expect(result.killed).toBe(0);
    expect(result.stale).toBe(1);
    expect(trackerRows()).toHaveLength(0);
  });

  it("terminates this process's own children on shutdown", async () => {
    const child = spawnIdle();
    registerSpawned(child);

    const tracker = tc.container.resolve(ChildProcessTracker);
    await tracker.terminateAll();

    expect(await hasExited(child.pid as number)).toBe(true);
    expect(trackerRows()).toHaveLength(0);
  });

  it("leaves another process's children alone on shutdown", async () => {
    const child = spawnIdle();
    tc.databaseClient.db
      .insert(childProcesses)
      .values({
        id: generateId(),
        pid: child.pid as number,
        ownerPid: 1,
        jobId: null,
        command: `${process.execPath} -e ${IDLE_SCRIPT}`,
        cwd: process.cwd(),
        startedAt: Date.now(),
      })
      .run();

    const tracker = tc.container.resolve(ChildProcessTracker);
    await tracker.terminateAll();

    expect(isAlive(child.pid as number)).toBe(true);
    expect(trackerRows()).toHaveLength(1);
  });
});

function killGroupQuietly(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
}

async function hasExited(pid: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

function readFirstOutput(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("child printed nothing")), 5000);
    child.stdout?.setEncoding("utf8");
    child.stdout?.once("data", (chunk: string) => {
      clearTimeout(timer);
      resolve(Number(chunk.trim()));
    });
  });
}
