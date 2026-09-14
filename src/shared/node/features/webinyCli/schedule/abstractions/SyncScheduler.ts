import { createAbstraction } from "@webiny/stdlib";

export interface ISyncSchedulerResult {
  /** Job ids enqueued by this run. */
  enqueued: string[];
  /** Projects skipped, with the reason. */
  skipped: Array<{ projectId: string; reason: string }>;
}

export interface ISyncScheduler {
  /** Enqueues a `sync-system` job for every project that has a local checkout. */
  execute(): Promise<ISyncSchedulerResult>;
}

export const SyncScheduler = createAbstraction<ISyncScheduler>("WebinyCli/SyncScheduler");

export namespace SyncScheduler {
  export type Interface = ISyncScheduler;
  export type Result = ISyncSchedulerResult;
}
