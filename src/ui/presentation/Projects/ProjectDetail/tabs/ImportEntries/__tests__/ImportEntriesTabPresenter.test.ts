import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { ImportEntriesTabFeature } from "../feature.js";
import { ImportEntriesTabPresenter } from "../abstractions/ImportEntriesTabPresenter.js";

const TENANTS_PATH = "/api/projects/:projectId/environments/:environmentId/tenants";
const MODELS_PATH = "/api/projects/:projectId/environments/:environmentId/models";
const IMPORT_PATH = "/api/projects/:projectId/environments/:environmentId/import";
const CLEANUP_PATH = "/api/projects/:projectId/environments/:environmentId/cleanup";
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function tenant(tenantId: string) {
  return {
    id: tenantId,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    tenantId,
    name: `Tenant ${tenantId}`,
    apiToken: null,
    discoveredAt: 1,
  };
}

function model(modelId: string) {
  return {
    id: modelId,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    tenant: "root",
    groupSlug: "blog",
    modelId,
    name: `Model ${modelId}`,
    singularApiName: modelId,
    pluralApiName: `${modelId}s`,
    description: null,
    fields: [],
    plugin: false,
    remoteId: null,
    syncedAt: 1,
  };
}

describe("ImportEntriesTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: ImportEntriesTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    ImportEntriesTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    http.data.set(TENANTS_PATH, [tenant("root")]);
    http.data.set(MODELS_PATH, [model("blog")]);
    presenter = ImportEntriesTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.tenants).toEqual([]);
    expect(presenter.vm.models).toEqual([]);
  });

  it("reads both datasets once the environment arrives, and shows them to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.tenants.length + presenter.vm.models.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(2);
    expect(presenter.vm.tenants[0]?.tenantId).toBe("root");
    expect(presenter.vm.models[0]?.modelId).toBe("blog");
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.callsTo(TENANTS_PATH)).toHaveLength(1);
    expect(http.callsTo(MODELS_PATH)).toHaveLength(1);
  });

  it("does not mark the tab loaded when only one of the two datasets fails", async () => {
    http.failures.set(MODELS_PATH, "gateway down");

    await presenter.activate(CONTEXT);

    expect(presenter.vm.tenants).toEqual([]);
    expect(presenter.vm.models).toEqual([]);

    http.failures.delete(MODELS_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.tenants).toHaveLength(1);
    expect(presenter.vm.models).toHaveLength(1);
  });

  it("opens a confirmation before starting an import job, and starts it once confirmed", async () => {
    await presenter.activate(CONTEXT);

    presenter.importEntries("root", ["blog"]);
    expect(presenter.vm.confirmation.isOpen).toBe(true);
    expect(http.callsTo(IMPORT_PATH)).toHaveLength(0);

    await presenter.confirmImport();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.callsTo(IMPORT_PATH)).toHaveLength(1);
    expect(http.callsTo(IMPORT_PATH)[0]?.body).toEqual({ tenant: "root", models: ["blog"] });
  });

  it("cancelling the confirmation never starts the import job", async () => {
    await presenter.activate(CONTEXT);

    presenter.importEntries("root", ["blog"]);
    presenter.cancelImport();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    expect(http.callsTo(IMPORT_PATH)).toHaveLength(0);
  });

  it("does nothing when asked to import with no models selected", async () => {
    await presenter.activate(CONTEXT);

    presenter.importEntries("root", []);

    expect(presenter.vm.confirmation.isOpen).toBe(false);
  });

  it("runs the cleanup job and reports it, closing the dialog first", async () => {
    await presenter.activate(CONTEXT);
    presenter.openCleanupDialog();
    expect(presenter.vm.showCleanupDialog).toBe(true);

    const pending = presenter.confirmCleanup();
    expect(presenter.vm.showCleanupDialog).toBe(false);
    expect(presenter.vm.isCleaningUp).toBe(true);

    await pending;

    expect(presenter.vm.isCleaningUp).toBe(false);
    expect(http.callsTo(CLEANUP_PATH)).toHaveLength(1);
  });

  it("closing the cleanup dialog never starts the cleanup job", async () => {
    await presenter.activate(CONTEXT);
    presenter.openCleanupDialog();
    presenter.closeCleanupDialog();

    expect(presenter.vm.showCleanupDialog).toBe(false);
    expect(http.callsTo(CLEANUP_PATH)).toHaveLength(0);
  });

  it("reads again when a job that writes tenants finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(TENANTS_PATH, [tenant("root"), tenant("acme")]);

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "completed",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.tenants).toHaveLength(2);
  });

  it("reads again when a job that writes models finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(MODELS_PATH, [model("blog"), model("author")]);

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-models",
      status: "completed",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.models).toHaveLength(2);
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
});
