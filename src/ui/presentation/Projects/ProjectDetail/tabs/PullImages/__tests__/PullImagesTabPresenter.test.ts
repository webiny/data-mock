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
import { pullProjectFilesRoute } from "~/shared/routes/files.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { PullImagesTabFeature } from "../feature.js";
import { PullImagesTabPresenter } from "../abstractions/PullImagesTabPresenter.js";

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
    type: "pull-files",
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
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe("PullImagesTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: PullImagesTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    PullImagesTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.data.set(LIST_PATH, [syncLog("l1")]);
    presenter = PullImagesTabFeature.resolve(container).presenter;
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

  it("narrows the shared sync log dataset to upload and pull-files entries", async () => {
    http.data.set(LIST_PATH, [
      syncLog("l1", { type: "pull-files" }),
      syncLog("l2", { type: "upload-file" }),
      syncLog("l3", { type: "tenants" }),
      syncLog("l4", { type: "models" }),
    ]);

    await presenter.activate(CONTEXT);

    expect(presenter.vm.syncLogs.map((log) => log.id).sort()).toEqual(["l1", "l2"]);
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
    http.data.set(pullProjectFilesRoute.path, { synced: 3 });

    presenter.pullFiles();
    expect(presenter.vm.confirmation.isOpen).toBe(true);
    expect(presenter.vm.confirmation.title).toBe("Pull files");

    const pullCallsBefore = http.calls.filter((call) => call.path === pullProjectFilesRoute.path);
    expect(pullCallsBefore).toHaveLength(0);

    await presenter.confirmAction();

    const pullCalls = http.calls.filter((call) => call.path === pullProjectFilesRoute.path);
    expect(pullCalls).toHaveLength(1);
    expect(pullCalls[0]?.params).toEqual({
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
    });
    expect(pullCalls[0]?.body).toEqual({ tenant: "root" });
    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(presenter.vm.isPullingFiles).toBe(false);
  });

  it("does not pull when the confirmation is cancelled", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullFiles();
    presenter.cancelAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.calls.filter((call) => call.path === pullProjectFilesRoute.path)).toHaveLength(0);
  });

  it("does nothing when asked to pull without a resolved environment", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    presenter.pullFiles();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });

  it("reports the pull failing without leaving the pulling flag stuck on", async () => {
    await presenter.activate(CONTEXT);
    http.failures.set(pullProjectFilesRoute.path, "cannot reach the file manager");

    presenter.pullFiles();
    await presenter.confirmAction();

    expect(presenter.vm.isPullingFiles).toBe(false);
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
    http.data.set(LIST_PATH, [syncLog("l1"), syncLog("l2")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "upload-files",
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
      type: "upload-files",
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
      type: "upload-files",
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
      type: "upload-files",
      status: "completed",
    });
    await flush();

    expect(http.calls).toHaveLength(before);
  });
});
