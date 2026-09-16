import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { ActivityPresentationFeature } from "../feature.js";
import { ActivityPresenter } from "../abstractions/ActivityPresenter.js";

const JOBS_PATH = "/api/jobs";
const CANCEL_PATH = "/api/jobs/:jobId/cancel";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "j1",
    projectId: null,
    environmentId: null,
    type: "sync-preview",
    status: "completed",
    config: null,
    logs: null,
    result: null,
    progress: null,
    progressLabel: null,
    startedAt: null,
    completedAt: null,
    createdAt: 1,
    ...overrides,
  };
}

describe("ActivityPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    HTTPClientFeature.register(container, { baseUrl: "" });
    ActivityPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());

    http.data.set(JOBS_PATH, [makeJob()]);
    http.data.set(CANCEL_PATH, makeJob({ status: "cancelled" }));
  });

  function presenter() {
    return container.resolve(ActivityPresenter);
  }

  it("lists a job that belongs to no project", async () => {
    const p = presenter();
    await p.load();

    // The project's own Jobs tab filters by project id, which leaves these with nowhere to be seen.
    expect(p.vm.jobs).toHaveLength(1);
    expect(p.vm.jobs[0]?.projectId).toBeNull();
  });

  it("says why the table is empty when it could not be read", async () => {
    http.failures.set(JOBS_PATH, "gateway timeout");

    const p = presenter();
    await p.load();

    expect(p.vm.error).toContain("gateway timeout");
    expect(p.vm.jobs).toEqual([]);
  });

  it("re-reads when a filter changes", async () => {
    const p = presenter();
    await p.load();
    const before = http.callsTo(JOBS_PATH).length;

    p.setFilter("jobStatus", "failed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(http.callsTo(JOBS_PATH).length).toBe(before + 1);
    expect(p.vm.statusFilter).toBe("failed");
  });

  it("cancels through the route that does not care about the project", async () => {
    const p = presenter();
    await p.load();

    await p.cancelJob("j1");

    expect(http.callsTo(CANCEL_PATH)).toHaveLength(1);
  });

  it("reloads when a job reaches a terminal status", async () => {
    const p = presenter();
    await p.load();
    const before = http.callsTo(JOBS_PATH).length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: null,
      type: "sync-preview",
      status: "completed",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(http.callsTo(JOBS_PATH).length).toBe(before + 1);
  });
});
