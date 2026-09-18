import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { SyncLog } from "~/shared/types.js";
import { deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { syncProjectTenantsRoute } from "~/shared/routes/tenants.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { PullTenantsTabFeature } from "../feature.js";
import { PullTenantsTabPresenter } from "../abstractions/PullTenantsTabPresenter.js";

const LIST_PATH = "/api/projects/p1/environments/e1/sync-logs";
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

function listResponse(logs: SyncLog[], total?: number) {
  return { syncLogs: { items: logs, total: total ?? logs.length } };
}

/**
 * The untyped `get` path (`SyncLogsGateway.list`) resolves through one more microtask hop than
 * the typed `request` path other gateways use, since it returns a promise from an async function
 * rather than awaiting it directly. A fixed handful of ticks flushes either.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe("PullTenantsTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: PullTenantsTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    PullTenantsTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.urlData.set(LIST_PATH, listResponse([syncLog("l1")]));
    presenter = PullTenantsTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.syncLogs).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.syncLogs.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.syncLogs[0]?.id).toBe("l1");
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === LIST_PATH)).toHaveLength(1);
  });

  it("filters the read to tenant-type logs", async () => {
    await presenter.activate(CONTEXT);

    const listCall = http.calls.find((call) => call.path.startsWith(LIST_PATH));
    expect(listCall).toBeDefined();
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(LIST_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.syncLogs).toEqual([]);

    http.failures.delete(LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.syncLogs).toHaveLength(1);
  });

  it("asks for confirmation before pulling, and pulls only once confirmed", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(syncProjectTenantsRoute.path, { id: "job1" });

    presenter.pullTenants();
    expect(presenter.vm.confirmation.isOpen).toBe(true);
    expect(presenter.vm.confirmation.title).toBe("Pull tenants");

    const pullCallsBefore = http.calls.filter((call) => call.path === syncProjectTenantsRoute.path);
    expect(pullCallsBefore).toHaveLength(0);

    await presenter.confirmAction();

    const pullCalls = http.calls.filter((call) => call.path === syncProjectTenantsRoute.path);
    expect(pullCalls).toHaveLength(1);
    expect(pullCalls[0]?.params).toEqual({
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
    });
    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(presenter.vm.isSyncingTenants).toBe(false);
  });

  it("does not pull when the confirmation is cancelled", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullTenants();
    presenter.cancelAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.calls.filter((call) => call.path === syncProjectTenantsRoute.path)).toHaveLength(0);
  });

  it("does nothing when asked to pull without a resolved environment", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    presenter.pullTenants();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });

  it("reports the pull failing without leaving the sync flag stuck on", async () => {
    await presenter.activate(CONTEXT);
    http.failures.set(syncProjectTenantsRoute.path, "cannot reach the live system");

    presenter.pullTenants();
    await presenter.confirmAction();

    expect(presenter.vm.isSyncingTenants).toBe(false);
  });

  it("deletes a sync log and removes it from the vm", async () => {
    await presenter.activate(CONTEXT);
    expect(presenter.vm.syncLogs).toHaveLength(1);

    await presenter.deleteSyncLog("l1");

    expect(presenter.vm.syncLogs).toHaveLength(0);
    expect(http.calls.some((call) => call.path === deleteSyncLogRoute.path)).toBe(true);
  });

  it("does nothing on delete without a resolved environment", async () => {
    await presenter.deleteSyncLog("l1");

    expect(http.calls).toHaveLength(0);
  });

  it("reads again when a job that writes sync logs finishes", async () => {
    await presenter.activate(CONTEXT);
    http.urlData.set(LIST_PATH, listResponse([syncLog("l1"), syncLog("l2")]));

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "completed",
    });
    await flush();

    expect(presenter.vm.syncLogs).toHaveLength(2);
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
    await flush();

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
    await flush();

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
    await flush();

    expect(http.calls).toHaveLength(before);
  });

  it("reads the next page when the page changes", async () => {
    await presenter.activate(CONTEXT);
    http.urlData.set(LIST_PATH, listResponse([syncLog("l2")], 30));

    presenter.loadSyncLogsPage(2);
    await flush();

    expect(presenter.vm.syncLogsPage).toBe(2);
    expect(presenter.vm.syncLogs[0]?.id).toBe("l2");
    expect(presenter.vm.syncLogsTotalCount).toBe(30);
  });
});
