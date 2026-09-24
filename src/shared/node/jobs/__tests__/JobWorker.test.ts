import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { JobExecutorRegistry } from "../abstractions/JobExecutorRegistry.js";
import { JobExecutionContextFactory } from "../abstractions/JobExecutionContextFactory.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import { eq } from "drizzle-orm";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

/**
 * The worker itself: its polling loop, concurrency guard, cancellation handling, terminal-status
 * writes, and its error paths — as opposed to the executors, which own their own guard clauses
 * and are tested against a stub execution context instead (see `executionContext.ts`).
 */

/** Lets the worker's own awaits run before a test inspects the database. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * One executor, shared by every job a test hands to it, whose promise a test resolves or rejects
 * by hand — so a test can hold a job "running", cancel it mid-flight, or make it fail on cue.
 */
class ControlledExecutor {
  public readonly started: string[] = [];
  private readonly pending = new Map<
    string,
    { resolve: () => void; reject: (error: unknown) => void; signal: AbortSignal }
  >();

  public readonly registry: JobExecutorRegistry.Interface = {
    getExecutor: (): JobExecutor.Interface => ({
      type: "controlled",
      execute: (context: JobExecutor.ExecutionContext): Promise<void> => {
        this.started.push(context.jobId);
        return new Promise<void>((resolve, reject) => {
          this.pending.set(context.jobId, { resolve, reject, signal: context.signal });
        });
      },
    }),
  };

  public resolveJob(jobId: string): void {
    this.pending.get(jobId)?.resolve();
    this.pending.delete(jobId);
  }

  public rejectJob(jobId: string, error: unknown): void {
    this.pending.get(jobId)?.reject(error);
    this.pending.delete(jobId);
  }

  public signalOf(jobId: string): AbortSignal | undefined {
    return this.pending.get(jobId)?.signal;
  }

  public releaseAll(): void {
    for (const { resolve } of this.pending.values()) {
      resolve();
    }
    this.pending.clear();
  }
}

/** A registry that hands out exactly one executor, whatever job type is asked for. */
function registryFor(executor: JobExecutor.Interface): JobExecutorRegistry.Interface {
  return { getExecutor: (): JobExecutor.Interface => executor };
}

type JobsUpdateFields = Record<string, unknown>;

/**
 * Wraps a real DatabaseClient so that a write to `jobs` matching `matches` fails (or reports zero
 * rows changed) for the first `times` attempts, then behaves normally.
 *
 * Reproduces two things a real clock and a real database only produce by accident: a claim that
 * loses a race against another writer (`mode: "no-op"`, mirroring the guard's own reasoning that
 * `recoverStaleJobs` and `cancelJob` write the same rows), and a terminal write that throws
 * (`mode: "throw"`) — the failure mode a stranded seed run left running forever.
 */
function withPatchedJobsUpdate(
  databaseClient: DatabaseClient.Interface,
  options: {
    matches: (fields: JobsUpdateFields) => boolean;
    times: number;
    mode: "throw" | "no-op";
  },
): DatabaseClient.Interface {
  let remaining = options.times;
  const realDb = databaseClient.db;
  const fakeDb = Object.create(realDb) as typeof realDb;

  fakeDb.update = ((table: unknown) => {
    if (table !== jobs) {
      return realDb.update(table as never);
    }
    return {
      set(fields: JobsUpdateFields) {
        if (remaining > 0 && options.matches(fields)) {
          remaining -= 1;
          if (options.mode === "throw") {
            throw new Error("simulated database write failure");
          }
          return {
            where() {
              return { run: () => ({ changes: 0 }) };
            },
          };
        }
        return realDb.update(table as never).set(fields);
      },
    };
  }) as typeof realDb.update;

  return { db: fakeDb };
}

describe("JobWorker", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let executor: ControlledExecutor;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    projectId = (await createTestProject(tc)).projectId;
    executor = new ControlledExecutor();
    tc.container.registerInstance(JobExecutorRegistry, executor.registry);
  });

  afterEach(() => {
    executor.releaseAll();
    tc.cleanup();
  });

  function jobRow(jobId: string) {
    return tc.container
      .resolve(DatabaseClient)
      .db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();
  }

  describe("polling loop", () => {
    it("does not re-enter while a claiming pass is already in flight", async () => {
      const first = await tc.container.resolve(JobWorker).enqueue({ projectId, type: "seed" });
      const second = await tc.container
        .resolve(JobWorker)
        .enqueue({ projectId: null, type: "pull-picsum" });
      const worker = tc.container.resolve(JobWorker);

      // Fired back to back, with no await between them: the guard is what stops the second call
      // from claiming the same rows the first call is already claiming.
      const firstCall = worker.processNextJob();
      const secondCall = worker.processNextJob();
      await Promise.all([firstCall, secondCall]);
      await settle();

      expect(executor.started.sort()).toEqual([first, second].sort());
      expect(jobRow(first)?.status).toBe("running");
      expect(jobRow(second)?.status).toBe("running");
    });
  });

  describe("claim guard", () => {
    it("skips a job whose claim loses a race, leaving it for the next pass", async () => {
      // Patched in before the worker is first resolved: JobWorker is a singleton and captures
      // its DatabaseClient at construction, so the swap must happen before that first resolve.
      const dbClient = tc.container.resolve(DatabaseClient);
      tc.container.registerInstance(
        DatabaseClient,
        withPatchedJobsUpdate(dbClient, {
          matches: (fields) => fields["status"] === "running",
          times: 1,
          mode: "no-op",
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      expect(executor.started).toHaveLength(0);
      expect(jobRow(jobId)?.status).toBe("pending");
    });
  });

  describe("waiting label", () => {
    it("does not rewrite the label on a job that is already marked waiting", async () => {
      const worker = tc.container.resolve(JobWorker);
      const first = await worker.enqueue({ projectId, type: "seed" });
      const second = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();
      expect(jobRow(second)?.progressLabel).toBe("waiting: project busy");

      // First job is still blocked, so the second pass finds `second` already labeled and takes
      // the early-return branch instead of writing the same label again.
      await worker.processNextJob();
      await settle();

      expect(jobRow(first)?.status).toBe("running");
      expect(jobRow(second)?.status).toBe("pending");
      expect(jobRow(second)?.progressLabel).toBe("waiting: project busy");
    });
  });

  describe("no executor for the job's type", () => {
    it("fails the job rather than crashing the worker", async () => {
      tc.container.registerInstance(
        JobExecutorRegistry,
        registryFor({
          type: "seed",
          execute: () => {
            throw new Error("No executor for job type: seed");
          },
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      const row = jobRow(jobId);
      expect(row?.status).toBe("failed");
      expect(row?.logs).toContain("ERROR: Error: No executor for job type: seed");
    });
  });

  describe("an executor that throws", () => {
    it("fails the job and records the error's stack in the logs", async () => {
      tc.container.registerInstance(
        JobExecutorRegistry,
        registryFor({
          type: "seed",
          execute: async () => {
            throw new Error("boom");
          },
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      const row = jobRow(jobId);
      expect(row?.status).toBe("failed");
      expect(row?.logs).toContain("ERROR: Error: boom");
      expect(row?.completedAt).toBeGreaterThan(0);
    });

    it("falls back to the message when the thrown error carries no stack", async () => {
      tc.container.registerInstance(
        JobExecutorRegistry,
        registryFor({
          type: "seed",
          execute: async () => {
            const error = new Error("no stack here");
            delete error.stack;
            throw error;
          },
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      const row = jobRow(jobId);
      expect(row?.status).toBe("failed");
      expect(row?.logs).toContain("ERROR: no stack here");
    });

    it("stringifies a thrown value that is not an Error", async () => {
      tc.container.registerInstance(
        JobExecutorRegistry,
        registryFor({
          type: "seed",
          // A rejection, not a `throw` statement, so this stays a rejected value rather than an
          // Error — an executor that rejects with a plain string is what this reproduces.
          execute: () => Promise.reject("boom"),
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      const row = jobRow(jobId);
      expect(row?.status).toBe("failed");
      expect(row?.logs).toContain("ERROR: boom");
    });
  });

  describe("cancellation", () => {
    it("marks a job cancelled when the executor rejects after the signal aborts", async () => {
      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();
      expect(jobRow(jobId)?.status).toBe("running");

      const signal = executor.signalOf(jobId);
      signal?.addEventListener("abort", () => executor.rejectJob(jobId, new Error("aborted")));
      await worker.cancelJob(jobId);
      await settle();

      expect(jobRow(jobId)?.status).toBe("cancelled");
    });

    it("marks a job cancelled even when the executor ignores the signal and finishes normally", async () => {
      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      await worker.cancelJob(jobId);
      await settle();
      // The executor never looked at `signal` — it is still sitting on its own promise.
      expect(jobRow(jobId)?.status).toBe("running");

      executor.resolveJob(jobId);
      await settle();

      expect(jobRow(jobId)?.status).toBe("cancelled");
    });

    it("cancels a pending job directly, without ever starting its executor", async () => {
      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.cancelJob(jobId);
      await settle();

      expect(jobRow(jobId)?.status).toBe("cancelled");

      await worker.processNextJob();
      await settle();
      expect(executor.started).toHaveLength(0);
    });
  });

  describe("terminal status write", () => {
    it("still finishes the job when the executor reports progress and a result", async () => {
      tc.container.registerInstance(
        JobExecutorRegistry,
        registryFor({
          type: "seed",
          execute: async (context) => {
            context.setProgress({ percent: 40, label: "working" });
            context.setResult({ createdEntries: 3 });
          },
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      const job = await worker.getJob(jobId);
      expect(job?.status).toBe("completed");
      expect(job?.progress).toBe(100);
      expect(job?.progressLabel).toBeNull();
      expect(job?.result).toEqual({ createdEntries: 3 });
    });

    it("falls back to a bare status flip when the full completion write throws", async () => {
      // Patched in before the worker is first resolved: JobWorker is a singleton and captures
      // its DatabaseClient at construction, so the swap must happen before that first resolve.
      // Everything but the matched write still goes to the real database, so claiming and
      // running the job beforehand behaves exactly as it would without the patch.
      const dbClient = tc.container.resolve(DatabaseClient);
      tc.container.registerInstance(
        DatabaseClient,
        withPatchedJobsUpdate(dbClient, {
          matches: (fields) => "completedAt" in fields && "logs" in fields,
          times: 1,
          mode: "throw",
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();
      expect(jobRow(jobId)?.status).toBe("running");

      executor.resolveJob(jobId);
      await settle();
      await settle();

      // The full write (status + logs + progress) failed; the fallback write still flipped the
      // row out of "running" instead of stranding it there for good.
      expect(jobRow(jobId)?.status).toBe("completed");
      expect(jobRow(jobId)?.completedAt).toBeGreaterThan(0);
    });

    it("leaves the row for the next boot's stale-job recovery when even the fallback write fails", async () => {
      const dbClient = tc.container.resolve(DatabaseClient);
      tc.container.registerInstance(
        DatabaseClient,
        withPatchedJobsUpdate(dbClient, {
          matches: (fields) => "completedAt" in fields,
          times: 2,
          mode: "throw",
        }),
      );

      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      executor.resolveJob(jobId);
      await settle();
      await settle();

      // Both the full write and its narrower fallback failed — there is nothing left in-process
      // that can persist the outcome, so the row sits exactly where a restart's `recoverStaleJobs`
      // expects to find a job that never got to report how it ended.
      expect(jobRow(jobId)?.status).toBe("running");

      await worker.recoverStaleJobs();
      expect(jobRow(jobId)?.status).toBe("interrupted");
    });
  });

  describe("drain", () => {
    it("resolves only after the in-flight job settles", async () => {
      const worker = tc.container.resolve(JobWorker);
      const jobId = await worker.enqueue({ projectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      let drained = false;
      const drainPromise = worker.drain().then(() => {
        drained = true;
      });

      await settle();
      expect(drained).toBe(false);

      executor.resolveJob(jobId);
      await drainPromise;

      expect(drained).toBe(true);
      expect(jobRow(jobId)?.status).toBe("completed");
    });
  });

  describe("processing loop robustness", () => {
    it("survives a claiming pass whose execution context cannot be created", async () => {
      // Registered before the worker's first resolve — same reason as the DatabaseClient swaps
      // above: JobWorker is a singleton and captures its dependencies at construction. Only the
      // first project's context creation is broken, so the second job's own context still works
      // and proves the claiming pass moved on rather than stopping at the first failure.
      tc.container.registerInstance(JobExecutionContextFactory, {
        create: (input): JobExecutionContextFactory.Context => {
          if (input.projectId === projectId) {
            throw new Error("cannot allocate execution context");
          }
          const logs: string[] = [];
          let progressUsed = false;
          let result: string | null = null;
          return {
            appendLog: (line) => logs.push(line),
            setProgress: () => {
              progressUsed = true;
            },
            setResult: (value) => {
              result = JSON.stringify(value);
            },
            getLogs: () => logs.join("\n"),
            getResult: () => result,
            wasProgressUsed: () => progressUsed,
            dispose: () => {},
          };
        },
      });

      const worker = tc.container.resolve(JobWorker);
      const brokenJobId = await worker.enqueue({ projectId, type: "seed" });
      const secondProjectId = (await createTestProject(tc, { name: "Second" })).projectId;
      const secondJobId = await worker.enqueue({ projectId: secondProjectId, type: "seed" });

      await worker.processNextJob();
      await settle();

      // The broken job's own row never got a terminal write — nothing in its try/catch ever
      // ran — but the claiming pass itself survived to claim and start the next job.
      expect(jobRow(brokenJobId)?.status).toBe("running");
      expect(executor.started).toEqual([secondJobId]);
    });
  });
});

describe("JobWorker — MAX_CONCURRENT_JOBS from the environment", () => {
  const originalValue = process.env.MAX_CONCURRENT_JOBS;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.MAX_CONCURRENT_JOBS;
    } else {
      process.env.MAX_CONCURRENT_JOBS = originalValue;
    }
    vi.resetModules();
  });

  it("caps concurrency at a configured positive integer instead of the default of four", async () => {
    process.env.MAX_CONCURRENT_JOBS = "2";
    vi.resetModules();

    // The cap is read once at module load, so a fresh module graph is the only way to see it
    // pick up a different value than the default the rest of this file's tests run under.
    const { createTestContainer: freshCreateTestContainer } =
      await import("~/shared/node/testing/createTestContainer.js");
    const { JobWorker: FreshJobWorker } = await import("../abstractions/JobWorker.js");
    const { JobExecutorRegistry: FreshJobExecutorRegistry } =
      await import("../abstractions/JobExecutorRegistry.js");

    const freshTc = freshCreateTestContainer();
    try {
      const freshExecutor = new ControlledExecutor();
      freshTc.container.registerInstance(FreshJobExecutorRegistry, freshExecutor.registry);

      const worker = freshTc.container.resolve(FreshJobWorker);
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        ids.push(await worker.enqueue({ projectId: null, type: "pull-picsum" }));
      }

      await worker.processNextJob();
      await settle();

      expect(freshExecutor.started).toHaveLength(2);
      freshExecutor.releaseAll();
    } finally {
      freshTc.cleanup();
    }
  });
});
