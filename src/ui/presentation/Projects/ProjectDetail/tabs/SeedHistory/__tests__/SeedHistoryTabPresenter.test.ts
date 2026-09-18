import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import type { SeedJob } from "~/shared/types.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { SeedHistoryTabFeature } from "../feature.js";
import { SeedHistoryTabPresenter } from "../abstractions/SeedHistoryTabPresenter.js";

const LIST_PATH = "/api/projects/p1/seed-jobs";
const RESUME_PATH =
  "/api/projects/:projectId/environments/:environmentId/seed-jobs/:seedJobId/resume";
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function seedJob(id: string, overrides: Partial<SeedJob> = {}): SeedJob {
  return {
    id,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    status: "completed",
    config: { models: [{ modelId: "m1", amount: 5 }] },
    result: { created: 5, errors: [] },
    startedAt: 1,
    finishedAt: 2,
    createdAt: 1,
    ...overrides,
  };
}

/** Flushes the microtask queue so an unawaited `void reloadSeedJobs()` has resolved. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe("SeedHistoryTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: SeedHistoryTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    SeedHistoryTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.urlData.set(LIST_PATH, { seedJobs: { items: [seedJob("j1")], total: 1 } });
    presenter = SeedHistoryTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.seedJobs).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.seedJobs.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.seedJobs[0]?.id).toBe("j1");
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(LIST_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.seedJobs).toEqual([]);

    http.failures.delete(LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.seedJobs).toHaveLength(1);
  });

  it("reads again when a job that writes seed jobs finishes", async () => {
    await presenter.activate(CONTEXT);
    http.urlData.set(LIST_PATH, { seedJobs: { items: [seedJob("j1"), seedJob("j2")], total: 2 } });

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "job1",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await flush();

    expect(presenter.vm.seedJobs).toHaveLength(2);
  });

  it("ignores a job from another project", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "job1",
      projectId: "other",
      type: "seed",
      status: "completed",
    });
    await flush();

    expect(http.calls).toHaveLength(before);
  });

  it("ignores a job that has not reached a terminal status", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "job1",
      projectId: PROJECT_ID,
      type: "seed",
      status: "running",
    });
    await flush();

    expect(http.calls).toHaveLength(before);
  });

  it("stops listening once disposed", async () => {
    await presenter.activate(CONTEXT);
    presenter.dispose();
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "job1",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await flush();

    expect(http.calls).toHaveLength(before);
  });

  it("reads a new page when the page changes", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.filter((call) => call.path === LIST_PATH).length;

    presenter.loadSeedJobsPage(2);
    await flush();

    expect(presenter.vm.seedJobsPage).toBe(2);
    expect(http.calls.filter((call) => call.path === LIST_PATH).length).toBeGreaterThan(before);
  });

  it("filters by status, and reads again", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.filter((call) => call.path === LIST_PATH).length;

    presenter.setSeedJobsFilter("seedStatus", "completed");
    await flush();

    expect(presenter.vm.seedJobsStatusFilter).toBe("completed");
    expect(http.calls.filter((call) => call.path === LIST_PATH).length).toBeGreaterThan(before);
  });

  it("clears the status filter", async () => {
    await presenter.activate(CONTEXT);
    presenter.setSeedJobsFilter("seedStatus", "completed");
    await flush();

    presenter.clearSeedJobsFilter();
    await flush();

    expect(presenter.vm.seedJobsStatusFilter).toBeNull();
  });

  it("asks for confirmation before resuming, and resumes only once confirmed", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(RESUME_PATH, { id: "resume-job" });

    presenter.resumeSeedJob("j1");
    expect(presenter.vm.confirmation.isOpen).toBe(true);

    await presenter.confirmAction();

    const resumeCalls = http.calls.filter((call) => call.path === RESUME_PATH);
    expect(resumeCalls).toHaveLength(1);
    expect(resumeCalls[0]?.params).toEqual({
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      seedJobId: "j1",
    });
    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });

  it("does not resume when the confirmation is cancelled", async () => {
    await presenter.activate(CONTEXT);

    presenter.resumeSeedJob("j1");
    presenter.cancelAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.calls.filter((call) => call.path === RESUME_PATH)).toHaveLength(0);
  });

  it("does nothing when asked to resume without a resolved environment", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    presenter.resumeSeedJob("j1");

    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });
});
