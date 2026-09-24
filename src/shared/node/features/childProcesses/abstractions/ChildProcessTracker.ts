import { createAbstraction } from "@webiny/stdlib";

export interface IChildProcessRegisterInput {
  pid: number;
  /** The job the child belongs to, when it was spawned by one. Recorded for diagnostics only. */
  jobId?: string | null | undefined;
  /** The spawned binary, absolute when it was resolved inside the checkout. */
  file: string;
  args: string[];
  cwd: string;
}

export interface IChildProcessReapOutput {
  /** Process groups that were still alive and have been terminated. */
  killed: number;
  /** Rows whose process had already exited, or could no longer be confirmed as ours. */
  stale: number;
  /** Rows left alone because the process that spawned them is still running. */
  skipped: number;
}

export interface IChildProcessTracker {
  /**
   * Records a live child and returns the handle used to forget it again. Call it immediately after
   * spawn, and `unregister` from the child's `close` handler.
   */
  register(input: IChildProcessRegisterInput): string;
  unregister(handle: string): void;
  /** Terminates every child left behind by a previous run of this server. Call once, at boot. */
  reapOrphans(): Promise<IChildProcessReapOutput>;
  /** Terminates every child this server still owns. Call on shutdown, before draining jobs. */
  terminateAll(): Promise<void>;
}

export const ChildProcessTracker = createAbstraction<IChildProcessTracker>(
  "ChildProcesses/ChildProcessTracker",
);

export namespace ChildProcessTracker {
  export type Interface = IChildProcessTracker;
  export type Input = IChildProcessRegisterInput;
  export type ReapOutput = IChildProcessReapOutput;
}
