import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { SyncLog, Job } from "~/shared/types.js";
import { deleteSyncLogRoute } from "~/shared/routes/syncLogs.js";
import { syncProjectModelsRoute } from "~/shared/routes/models.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { PullModelsTabFeature } from "../feature.js";
import { PullModelsTabPresenter } from "../abstractions/PullModelsTabPresenter.js";

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
    type: "models",
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

function job(): Job {
  return {
    id: "j1",
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    type: "pull-models",
    status: "pending",
    config: null,
    logs: null,
    result: null,
    progress: null,
    progressLabel: null,
    startedAt: null,
    completedAt: null,
    createdAt: 1,
  };
}

/**
 * The untyped `get` path (`SyncLogsGateway.list`) resolves through one more microtask hop than
 * the typed `request` path other gateways use, since it returns a promise from an async function
 * rather than awaiting it directly. A fixed handful of ticks flushes either.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("PullModelsTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: PullModelsTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    PullModelsTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.urlData.set(LIST_PATH, listResponse([syncLog("l1")]));
    http.data.set(syncProjectModelsRoute.path, job());
    presenter = PullModelsTabFeature.resolve(container).presenter;
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

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(LIST_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.syncLogs).toEqual([]);

    http.failures.delete(LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.syncLogs).toHaveLength(1);
  });

  it("reads again when a job that writes sync logs finishes", async () => {
    await presenter.activate(CONTEXT);
    http.urlData.set(LIST_PATH, listResponse([syncLog("l1"), syncLog("l2")]));

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-models",
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
      type: "pull-models",
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
      type: "pull-models",
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
      type: "pull-models",
      status: "completed",
    });
    await Promise.resolve();

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

  it("does nothing when asked to pull without a resolved environment", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    presenter.pullModels();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });

  it("stands a confirmation dialog in front of the pull, naming the environment", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullModels();

    expect(presenter.vm.confirmation.isOpen).toBe(true);
    expect(presenter.vm.confirmation.title).toBe("Pull models");
    expect(presenter.vm.confirmation.message).toContain("dev");
    expect(http.calls.some((call) => call.path === syncProjectModelsRoute.path)).toBe(false);
  });

  it("cancelling the confirmation starts nothing", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullModels();
    presenter.cancelAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.calls.some((call) => call.path === syncProjectModelsRoute.path)).toBe(false);
  });

  it("confirming the pull starts the job and closes the dialog", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullModels();
    await presenter.confirmAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(presenter.vm.isSyncingModels).toBe(false);
    expect(http.calls.some((call) => call.path === syncProjectModelsRoute.path)).toBe(true);
  });

  it("reports a failed pull without leaving the dialog open", async () => {
    http.failures.set(syncProjectModelsRoute.path, "cli unreachable");
    await presenter.activate(CONTEXT);

    presenter.pullModels();
    await presenter.confirmAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(presenter.vm.isSyncingModels).toBe(false);
  });
});
