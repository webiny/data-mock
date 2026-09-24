import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { JobExecutorRegistry } from "../abstractions/JobExecutorRegistry.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

/**
 * An executor that never finishes on its own, so a test can hold jobs "running" and observe what
 * the worker does with the rest of the queue.
 */
class BlockingExecutor {
  public readonly started: string[] = [];
  private readonly releases: Array<() => void> = [];

  public readonly registry: JobExecutorRegistry.Interface = {
    getExecutor: (): JobExecutor.Interface => ({
      type: "blocking",
      execute: async (context: JobExecutor.ExecutionContext): Promise<void> => {
        this.started.push(context.jobId);
        await new Promise<void>((resolve) => this.releases.push(resolve));
      },
    }),
  };

  public releaseAll(): void {
    for (const release of this.releases.splice(0)) {
      release();
    }
  }
}

/** Lets the worker's own awaits run before the assertion looks at the database. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("JobWorker concurrency", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let executor: BlockingExecutor;
  let projectId: string;
  let otherProjectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    projectId = (await createTestProject(tc, { name: "One" })).projectId;
    otherProjectId = (await createTestProject(tc, { name: "Two" })).projectId;

    executor = new BlockingExecutor();
    tc.container.registerInstance(JobExecutorRegistry, executor.registry);
  });

  afterEach(() => {
    executor.releaseAll();
    tc.cleanup();
  });

  function statusOf(jobId: string): string | undefined {
    return tc.container
      .resolve(DatabaseClient)
      .db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get()?.status;
  }

  function labelOf(jobId: string): string | null | undefined {
    return tc.container
      .resolve(DatabaseClient)
      .db.select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get()?.progressLabel;
  }

  it("runs one job per project and leaves the rest pending", async () => {
    const worker = tc.container.resolve(JobWorker);
    const first = await worker.enqueue({ projectId, type: "seed" });
    const second = await worker.enqueue({ projectId, type: "seed" });

    await worker.processNextJob();
    await settle();

    expect(statusOf(first)).toBe("running");
    expect(statusOf(second)).toBe("pending");
    expect(executor.started).toEqual([first]);
  });

  it("labels the waiting job so it does not look stuck", async () => {
    const worker = tc.container.resolve(JobWorker);
    await worker.enqueue({ projectId, type: "seed" });
    const second = await worker.enqueue({ projectId, type: "seed" });

    await worker.processNextJob();
    await settle();

    expect(labelOf(second)).toBe("waiting: project busy");
  });

  it("clears the waiting label when the job is finally claimed", async () => {
    const worker = tc.container.resolve(JobWorker);
    const first = await worker.enqueue({ projectId, type: "seed" });
    const second = await worker.enqueue({ projectId, type: "seed" });

    await worker.processNextJob();
    await settle();
    expect(labelOf(second)).toBe("waiting: project busy");

    executor.releaseAll();
    await settle();
    await settle();

    await worker.processNextJob();
    await settle();

    expect(statusOf(first)).toBe("completed");
    expect(statusOf(second)).toBe("running");
    expect(labelOf(second)).toBeNull();
  });

  it("does not serialize different projects", async () => {
    const worker = tc.container.resolve(JobWorker);
    const first = await worker.enqueue({ projectId, type: "seed" });
    const second = await worker.enqueue({ projectId: otherProjectId, type: "seed" });

    await worker.processNextJob();
    await settle();

    expect(statusOf(first)).toBe("running");
    expect(statusOf(second)).toBe("running");
  });

  it("never blocks global jobs on a busy project", async () => {
    const worker = tc.container.resolve(JobWorker);
    await worker.enqueue({ projectId, type: "seed" });
    const globalFirst = await worker.enqueue({ projectId: null, type: "pull-picsum" });
    const globalSecond = await worker.enqueue({ projectId: null, type: "pull-picsum" });

    await worker.processNextJob();
    await settle();

    // Two global jobs run side by side: they belong to no project, so nothing serializes them.
    expect(statusOf(globalFirst)).toBe("running");
    expect(statusOf(globalSecond)).toBe("running");
  });

  it("stops at the global concurrency cap", async () => {
    const worker = tc.container.resolve(JobWorker);
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(await worker.enqueue({ projectId: null, type: "pull-picsum" }));
    }

    await worker.processNextJob();
    await settle();

    expect(executor.started).toHaveLength(4);
    expect(ids.slice(4).map(statusOf)).toEqual(["pending", "pending"]);
  });

  it("claims in creation order", async () => {
    const worker = tc.container.resolve(JobWorker);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(await worker.enqueue({ projectId: null, type: "pull-picsum" }));
      // enqueue stamps createdAt with Date.now(); without a gap the order is rowid luck.
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    await worker.processNextJob();
    await settle();

    expect(executor.started).toEqual(ids);
  });

  it("does not claim a job that was cancelled after it was selected", async () => {
    const worker = tc.container.resolve(JobWorker);
    const jobId = await worker.enqueue({ projectId, type: "seed" });

    // Simulates the race the claim guard exists for: the row leaves `pending` between the select
    // and the update.
    tc.container
      .resolve(DatabaseClient)
      .db.update(jobs)
      .set({ status: "cancelled" })
      .where(eq(jobs.id, jobId))
      .run();

    await worker.processNextJob();
    await settle();

    expect(statusOf(jobId)).toBe("cancelled");
    expect(executor.started).toHaveLength(0);
  });
});
