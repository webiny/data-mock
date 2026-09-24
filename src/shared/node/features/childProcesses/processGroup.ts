import { execFileSync } from "node:child_process";

/** How often the terminate loop re-checks whether the group has gone. */
const POLL_INTERVAL_MS = 100;

/**
 * Reads a running process's full argument vector, or null when no such process exists.
 *
 * `-ww` disables the column truncation `ps` applies when it thinks it is writing to a terminal;
 * without it a long `webiny deploy` line is cut short and the identity check below sees a prefix.
 */
export function readProcessCommand(pid: number): string | null {
  return runPs(["-ww", "-p", String(pid), "-o", "command="]);
}

/**
 * Reads the wall-clock time a process started, in epoch milliseconds, or null when it is gone.
 *
 * `lstart` has one-second resolution and prints local time ("Mon Sep 15 10:23:45 2026"), which is
 * why the caller compares it with a tolerance rather than for equality.
 */
export function readProcessStartedAt(pid: number): number | null {
  const output = runPs(["-p", String(pid), "-o", "lstart="]);
  if (output === null) {
    return null;
  }

  const parsed = Date.parse(output);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Whether a pid currently belongs to a running process.
 *
 * `EPERM` counts as alive. Signal 0 fails that way when the process exists but belongs to another
 * user, and reading that as "gone" would be the dangerous answer: the caller uses this to decide
 * whether a child is still owned, and an owner wrongly declared dead makes its child look reapable.
 */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error !== null && typeof error === "object" && "code" in error && error.code === "EPERM";
  }
}

/**
 * Signals the whole process group, falling back to the single process when the child was not made
 * a group leader.
 *
 * The group is what matters: `webiny` spawns pulumi, which spawns a provider process per plugin.
 * Signalling only the `webiny` pid leaves pulumi running against the stack — exactly the orphan
 * this module exists to prevent.
 */
export function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // Not a group leader (or the group is already gone) — fall through to the single process.
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Already exited between the check and the signal. Nothing to do.
  }
}

/**
 * SIGTERM, then SIGKILL if the group is still there after the grace period.
 *
 * SIGTERM first so pulumi can unwind and release its stack lock; a lock left behind blocks the
 * next deploy of that stack until it is removed by hand.
 */
export async function terminateProcessGroup(pid: number, graceMs: number): Promise<void> {
  signalProcessGroup(pid, "SIGTERM");

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return;
    }
    await delay(POLL_INTERVAL_MS);
  }

  signalProcessGroup(pid, "SIGKILL");
}

function runPs(args: string[]): string | null {
  try {
    const output = execFileSync("ps", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const trimmed = output.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    // A non-zero exit means no process with that pid. A missing `ps` (Windows) is the same answer
    // as far as the caller is concerned: it cannot confirm the process, so it must not kill it.
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
