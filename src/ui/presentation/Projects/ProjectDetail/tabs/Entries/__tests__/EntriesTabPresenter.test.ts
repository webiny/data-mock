import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { ModelsRepository } from "~/ui/features/models/abstractions/ModelsRepository.js";
import { TenantsRepository } from "~/ui/features/tenants/abstractions/TenantsRepository.js";
import { listSeedEntriesRoute, deleteProjectEntriesRoute } from "~/shared/routes/entries.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { EntriesTabFeature } from "../feature.js";
import { EntriesTabPresenter } from "../abstractions/EntriesTabPresenter.js";

const ENTRIES_LIST_PATH = listSeedEntriesRoute.path;
const CLEAR_ENTRIES_PATH = deleteProjectEntriesRoute.path;
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function entry(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    jobId: null,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    tenant: "root",
    modelId: "article",
    entryId: `entry-${id}`,
    entryData: {},
    requestData: null,
    responseData: null,
    httpStatus: null,
    status: "created",
    error: null,
    createdAt: 1,
    ...overrides,
  };
}

/** Drains the microtask queue behind an unawaited `void reload()`. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("EntriesTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: EntriesTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    EntriesTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());
    http.data.set(ENTRIES_LIST_PATH, [entry("1")]);
    presenter = EntriesTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.entries).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.entries.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.entries[0]?.entryId).toBe("entry-1");
    expect(presenter.vm.entriesTotalCount).toBe(1);
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === ENTRIES_LIST_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(ENTRIES_LIST_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.entries).toEqual([]);

    http.failures.delete(ENTRIES_LIST_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.entries).toHaveLength(1);
  });

  it("picks the jobId filter up from the URL query string on activation", async () => {
    // The real URLListState reads its filters from the URL at construction time; a fresh
    // presenter mounted with `?jobId=job-1` in the address bar must ask the gateway for that job.
    const container2 = new Container();
    const http2 = new StubHttpClient();
    HTTPClientFeature.register(container2, { baseUrl: "" });
    EntriesTabFeature.register(container2);
    container2.registerInstance(HTTPClient, http2.client);
    container2.registerInstance(
      URLListStateFactory,
      stubListStateFactoryWithInitial({ jobId: "job-1" }),
    );
    http2.data.set(ENTRIES_LIST_PATH, [entry("1", { jobId: "job-1" })]);
    const presenter2 = EntriesTabFeature.resolve(container2).presenter;

    await presenter2.activate(CONTEXT);

    expect(presenter2.vm.entriesJobFilter).toBe("job-1");
    const listCall = http2.calls.find((call) => call.path === ENTRIES_LIST_PATH);
    expect(listCall?.query).toMatchObject({ jobId: "job-1" });
  });

  it("reloads on each of the four filters", async () => {
    await presenter.activate(CONTEXT);

    presenter.setEntriesFilter("modelId", "article");
    expect(presenter.vm.entriesModelFilter).toBe("article");

    presenter.setEntriesFilter("tenant", "root");
    expect(presenter.vm.entriesTenantFilter).toBe("root");

    presenter.setEntriesFilter("status", "failed");
    expect(presenter.vm.entriesStatusFilter).toBe("failed");

    presenter.setEntriesFilter("jobId", "job-9");
    expect(presenter.vm.entriesJobFilter).toBe("job-9");

    await flush();
    await flush();

    const calls = http.calls.filter((call) => call.path === ENTRIES_LIST_PATH);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.at(-1)?.query).toMatchObject({
      modelId: "article",
      tenant: "root",
      status: "failed",
      jobId: "job-9",
    });
  });

  it("clears every filter and reloads", async () => {
    await presenter.activate(CONTEXT);
    presenter.setEntriesFilter("modelId", "article");
    presenter.setEntriesFilter("status", "failed");
    await flush();

    presenter.clearEntriesFilter();
    await flush();

    expect(presenter.vm.entriesModelFilter).toBeNull();
    expect(presenter.vm.entriesStatusFilter).toBeNull();
    expect(presenter.vm.entriesJobFilter).toBeNull();
    expect(presenter.vm.entriesTenantFilter).toBeNull();
    const calls = http.calls.filter((call) => call.path === ENTRIES_LIST_PATH);
    expect(calls.at(-1)?.query).toEqual({ page: "1", limit: "25" });
  });

  it("pages through the list", async () => {
    await presenter.activate(CONTEXT);

    presenter.loadEntriesPage(2);
    await flush();

    expect(presenter.vm.entriesPage).toBe(2);
    const calls = http.calls.filter((call) => call.path === ENTRIES_LIST_PATH);
    expect(calls.at(-1)?.query).toMatchObject({ page: "2" });
  });

  it("clears entries only after the confirmation is accepted", async () => {
    await presenter.activate(CONTEXT);

    presenter.clearEntries();
    expect(presenter.vm.clearConfirmation.isOpen).toBe(true);
    expect(http.callsTo(CLEAR_ENTRIES_PATH, "DELETE")).toHaveLength(0);

    await presenter.confirmClearEntries();

    expect(presenter.vm.clearConfirmation.isOpen).toBe(false);
    expect(http.callsTo(CLEAR_ENTRIES_PATH, "DELETE")).toHaveLength(1);
  });

  it("closes the confirmation without clearing on cancel", async () => {
    await presenter.activate(CONTEXT);

    presenter.clearEntries();
    presenter.cancelClearEntries();

    expect(presenter.vm.clearConfirmation.isOpen).toBe(false);
    expect(http.callsTo(CLEAR_ENTRIES_PATH, "DELETE")).toHaveLength(0);
  });

  it("reads models and tenants for the filter dropdowns from their own repositories", async () => {
    await presenter.activate(CONTEXT);

    container.resolve(ModelsRepository).setModels([
      {
        id: "m1",
        projectId: PROJECT_ID,
        environmentId: ENVIRONMENT_ID,
        groupSlug: "content",
        modelId: "article",
        name: "Article",
        singularApiName: "article",
        pluralApiName: "articles",
        description: null,
        fields: [],
        plugin: false,
        remoteId: null,
        syncedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    container.resolve(TenantsRepository).setTenants(ENVIRONMENT_ID, [
      {
        id: "t1",
        projectId: PROJECT_ID,
        environmentId: ENVIRONMENT_ID,
        tenantId: "root",
        name: "Root",
        discoveredAt: 1,
      },
    ]);

    expect(presenter.vm.models).toEqual([{ modelId: "article", name: "Article" }]);
    expect(presenter.vm.tenants).toEqual([{ tenantId: "root", name: "Root" }]);
  });

  it("reads again when a job that writes entries finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(ENTRIES_LIST_PATH, [entry("1"), entry("2")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await flush();

    expect(presenter.vm.entries).toHaveLength(2);
  });

  it("ignores a job from another project", async () => {
    await presenter.activate(CONTEXT);
    const before = http.calls.length;

    container.resolve(EventBridge).emit("job:status", {
      jobId: "j1",
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
      jobId: "j1",
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
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "seed",
      status: "completed",
    });
    await flush();

    expect(http.calls).toHaveLength(before);
  });
});

/**
 * `stubListStateFactory()` always starts empty — the real factory is what reads the URL, at
 * construction time. This wraps it with an initial value so the "arrives with a filter already in
 * the query string" case can be exercised without a browser location.
 */
function stubListStateFactoryWithInitial(
  initial: Record<string, string>,
): URLListStateFactory.Interface {
  const base = stubListStateFactory();
  return {
    create: (config) => {
      const state = base.create(config);
      for (const [key, value] of Object.entries(initial)) {
        state.set(key, value);
      }
      return state;
    },
  };
}
