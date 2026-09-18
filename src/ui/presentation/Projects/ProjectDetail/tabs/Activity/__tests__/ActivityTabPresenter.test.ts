import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { SyncLog } from "~/shared/types.js";
import { listSyncLogsRoute, deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { ActivityTabFeature } from "../feature.js";
import { ActivityTabPresenter } from "../abstractions/ActivityTabPresenter.js";

const LIST_PATH = listSyncLogsRoute.path;
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function syncLog(id: string, overrides: Partial<SyncLog> = {}): SyncLog {
  return {
    id,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    type: "tenants",
    status: "success",
    message: `Log ${id}`,
    request: null,
    response: null,
    createdAt: 1,
    ...overrides,
  };
}

/** Drains the microtask queue behind an unawaited `void reload()`. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("ActivityTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: ActivityTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    ActivityTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.data.set(LIST_PATH, [syncLog("l1")]);
    presenter = ActivityTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.syncLog).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.syncLog.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.syncLog[0]?.id).toBe("l1");
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
    expect(presenter.vm.syncLog).toEqual([]);

    http.failures.delete(LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.syncLog).toHaveLength(1);
  });

  it("reads again when a job that writes sync logs finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(LIST_PATH, [syncLog("l1"), syncLog("l2")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "completed",
    });
    await flush();

    expect(presenter.vm.syncLog).toHaveLength(2);
  });

  it("ignores a job from another project", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: "other",
      type: "pull-tenants",
      status: "completed",
    });
    await Promise.resolve();

    expect(http.calls).toHaveLength(before);
  });

  it("ignores a job that has not reached a terminal status", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "running",
    });
    await Promise.resolve();

    expect(http.calls).toHaveLength(before);
  });

  it("stops listening once disposed", async () => {
    await presenter.activate(CONTEXT);
    presenter.dispose();
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "completed",
    });
    await Promise.resolve();

    expect(http.calls).toHaveLength(before);
  });

  it("reads the next page when the page changes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(LIST_PATH, [syncLog("l2")]);

    presenter.loadSyncLogsPage(2);
    await flush();

    expect(presenter.vm.syncLogsPage).toBe(2);
    expect(presenter.vm.syncLog[0]?.id).toBe("l2");
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ page: "2" });
  });

  it("reads with the type filter applied, and reflects it in the vm", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(LIST_PATH, [syncLog("l2", { type: "models" })]);

    presenter.setSyncLogsFilter("logType", "models");
    await flush();

    expect(presenter.vm.syncLogsTypeFilter).toBe("models");
    expect(presenter.vm.syncLog[0]?.type).toBe("models");
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ type: "models" });
  });

  it("reads with the status filter applied, and reflects it in the vm", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(LIST_PATH, [syncLog("l2", { status: "error" })]);

    presenter.setSyncLogsFilter("logStatus", "error");
    await flush();

    expect(presenter.vm.syncLogsStatusFilter).toBe("error");
    expect(presenter.vm.syncLog[0]?.status).toBe("error");
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ status: "error" });
  });

  it("clears both filters at once", async () => {
    await presenter.activate(CONTEXT);
    presenter.setSyncLogsFilter("logType", "models");
    presenter.setSyncLogsFilter("logStatus", "error");
    http.data.set(LIST_PATH, [syncLog("l1")]);
    await flush();

    presenter.clearSyncLogsFilter();
    await flush();

    expect(presenter.vm.syncLogsTypeFilter).toBeNull();
    expect(presenter.vm.syncLogsStatusFilter).toBeNull();
    const calls = http.calls.filter((call) => call.path === LIST_PATH);
    expect(calls.at(-1)?.query).toEqual({ page: "1", limit: "25" });
  });

  it("deletes a sync log and removes it from the vm", async () => {
    await presenter.activate(CONTEXT);
    expect(presenter.vm.syncLog).toHaveLength(1);

    await presenter.deleteSyncLog("l1");

    expect(presenter.vm.syncLog).toHaveLength(0);
    expect(http.calls.some((call) => call.path === deleteSyncLogRoute.path)).toBe(true);
  });

  it("does nothing on delete without a resolved environment", async () => {
    await presenter.deleteSyncLog("l1");

    expect(http.calls).toHaveLength(0);
  });
});
