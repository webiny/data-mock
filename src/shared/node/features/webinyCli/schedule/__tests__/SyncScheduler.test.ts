import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";
import { SyncScheduler } from "../abstractions/SyncScheduler.js";

describe("SyncScheduler", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let tmp: string;

  beforeEach(() => {
    tc = createTestContainer();
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sync-scheduler-")));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    tc.cleanup();
  });

  async function createProject(name: string, rootPath?: string): Promise<string> {
    const result = await tc.container
      .resolve(CreateProjectUseCase)
      .execute(
        rootPath === undefined
          ? { name, apiUrl: "https://api.example.com", apiToken: "token" }
          : { name, rootPath },
      );
    if (result.isFail()) {
      throw new Error(`Failed to create project: ${result.error.message}`);
    }
    return result.value.project.id;
  }

  it("enqueues one sync-system job per project with a checkout", async () => {
    const withCheckout = await createProject("With Checkout", tmp);
    await createProject("Remote Only");

    const result = await tc.container.resolve(SyncScheduler).execute();

    expect(result.enqueued).toHaveLength(1);
    expect(result.skipped).toEqual([
      { projectId: expect.any(String), reason: "no local checkout" },
    ]);

    const jobs = await tc.container.resolve(JobWorker).listJobs({ projectId: withCheckout });
    expect(jobs.jobs.map((job) => job.type)).toEqual(["sync-system"]);
  });

  it("does not queue a second sync behind one that is already pending", async () => {
    await createProject("With Checkout", tmp);

    const scheduler = tc.container.resolve(SyncScheduler);
    const first = await scheduler.execute();
    const second = await scheduler.execute();

    expect(first.enqueued).toHaveLength(1);
    expect(second.enqueued).toHaveLength(0);
    expect(second.skipped[0]?.reason).toBe("a sync is already queued");
  });

  it("skips archived projects", async () => {
    const projectId = await createProject("Archived", tmp);
    await tc.container.resolve(ArchiveProjectRepository).execute({ id: projectId, archived: true });

    const result = await tc.container.resolve(SyncScheduler).execute();

    expect(result.enqueued).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});
