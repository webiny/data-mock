import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { TenantsTabFeature } from "../feature.js";
import { TenantsTabPresenter } from "../abstractions/TenantsTabPresenter.js";

const TENANTS_PATH = "/api/projects/:projectId/environments/:environmentId/tenants";
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function tenant(tenantId: string, apiToken: string | null = null) {
  return {
    id: tenantId,
    environmentId: ENVIRONMENT_ID,
    tenantId,
    name: `Tenant ${tenantId}`,
    apiToken,
    discoveredAt: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("TenantsTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: TenantsTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    TenantsTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    http.data.set(TENANTS_PATH, [tenant("root")]);
    presenter = TenantsTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.tenants).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.tenants.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.tenants[0]?.tenantId).toBe("root");
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === TENANTS_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(TENANTS_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.tenants).toEqual([]);

    http.failures.delete(TENANTS_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.tenants).toHaveLength(1);
  });

  it("reads again when a job that writes tenants finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(TENANTS_PATH, [tenant("root"), tenant("acme")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-tenants",
      status: "completed",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.tenants).toHaveLength(2);
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

  describe("API tokens", () => {
    const UPDATE_PATH = "/api/projects/:projectId/environments/:environmentId/tenants/:tenantId";

    beforeEach(() => {
      http.data.set(TENANTS_PATH, [tenant("root"), tenant("acme", "acme-token"), tenant("beta")]);
    });

    it("says which key each tenant talks with", async () => {
      await presenter.activate(CONTEXT);

      expect(presenter.vm.tenants.map((t) => [t.tenantId, t.keySource])).toEqual([
        ["root", "environment"],
        ["acme", "own"],
        ["beta", "none"],
      ]);
    });

    it("saves a token and shows it without reading the list again", async () => {
      http.data.set(UPDATE_PATH, tenant("beta", "beta-token"));
      await presenter.activate(CONTEXT);
      presenter.openEditToken("beta");

      const saved = await presenter.submitToken("beta-token");

      expect(saved).toBe(true);
      expect(http.callsTo(UPDATE_PATH, "PUT")[0]?.body).toEqual({ apiToken: "beta-token" });
      expect(presenter.vm.tenants.find((t) => t.tenantId === "beta")?.keySource).toBe("own");
      expect(presenter.vm.editingTenant).toBeNull();
    });

    it("removes the tenant's own token when the field is emptied", async () => {
      http.data.set(UPDATE_PATH, tenant("acme"));
      await presenter.activate(CONTEXT);
      presenter.openEditToken("acme");

      await presenter.submitToken("");

      expect(http.callsTo(UPDATE_PATH, "PUT")[0]?.body).toEqual({ apiToken: null });
    });

    it("keeps the dialog open when the save fails", async () => {
      http.failures.set(UPDATE_PATH, "refused");
      await presenter.activate(CONTEXT);
      presenter.openEditToken("beta");

      expect(await presenter.submitToken("x")).toBe(false);
      expect(presenter.vm.editingTenant?.tenantId).toBe("beta");
    });
  });
});
