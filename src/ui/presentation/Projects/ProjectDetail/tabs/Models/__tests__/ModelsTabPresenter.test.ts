import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { ModelsTabFeature } from "../feature.js";
import { ModelsTabPresenter } from "../abstractions/ModelsTabPresenter.js";

const MODELS_PATH = "/api/projects/:projectId/environments/:environmentId/models";
const TENANTS_PATH = "/api/projects/:projectId/environments/:environmentId/tenants";
const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function model(modelId: string, groupSlug = "content", tenant = "root") {
  return {
    id: `${tenant}-${modelId}`,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    tenant,
    groupSlug,
    modelId,
    name: `Model ${modelId}`,
    singularApiName: modelId,
    pluralApiName: `${modelId}s`,
    description: null,
    fields: [],
    plugin: false,
    remoteId: null,
    syncedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("ModelsTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: ModelsTabPresenter.Interface;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    ModelsTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    http.data.set(MODELS_PATH, [model("article")]);
    presenter = ModelsTabFeature.resolve(container).presenter;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.models).toEqual([]);
    expect(presenter.vm.groups).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.models.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.models[0]?.modelId).toBe("article");
    expect(presenter.vm.groups).toEqual([{ slug: "content", name: "content", modelCount: 1 }]);
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.calls.filter((call) => call.path === MODELS_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(MODELS_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.models).toEqual([]);

    http.failures.delete(MODELS_PATH);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.models).toHaveLength(1);
  });

  it("groups models by groupSlug, counting each group's models", async () => {
    http.data.set(MODELS_PATH, [
      model("article", "content"),
      model("page", "content"),
      model("category", "taxonomy"),
    ]);

    await presenter.activate(CONTEXT);

    expect(presenter.vm.groups).toEqual(
      expect.arrayContaining([
        { slug: "content", name: "content", modelCount: 2 },
        { slug: "taxonomy", name: "taxonomy", modelCount: 1 },
      ]),
    );
  });

  it("reads again when a job that writes models finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(MODELS_PATH, [model("article"), model("page")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "pull-models",
      status: "completed",
    });
    // The re-read asks for models and tenants together; let both settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(presenter.vm.models).toHaveLength(2);
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

  describe("per tenant", () => {
    beforeEach(() => {
      http.data.set(MODELS_PATH, [
        model("article"),
        model("page"),
        model("product", "shop", "acme"),
      ]);
    });

    it("starts on the environment's own tenant and lists only its models", async () => {
      await presenter.activate(CONTEXT);

      expect(presenter.vm.tenants.map((t) => [t.tenantId, t.modelCount])).toEqual([
        ["root", 2],
        ["acme", 1],
      ]);
      expect(presenter.vm.selectedTenant).toBe("root");
      expect(presenter.vm.models.map((m) => m.modelId)).toEqual(["article", "page"]);
    });

    it("switches to another tenant's models", async () => {
      await presenter.activate(CONTEXT);

      presenter.selectTenant("acme");

      expect(presenter.vm.models.map((m) => m.modelId)).toEqual(["product"]);
      expect(presenter.vm.groups.map((g) => g.slug)).toEqual(["shop"]);
    });

    it("offers a pulled tenant that has no models yet", async () => {
      http.data.set(TENANTS_PATH, [
        { tenantId: "root", name: "Root" },
        { tenantId: "acme", name: "Acme" },
        { tenantId: "beta", name: "Beta" },
      ]);
      await presenter.activate(CONTEXT);

      expect(presenter.vm.tenants.map((t) => [t.tenantId, t.modelCount])).toEqual([
        ["root", 2],
        ["acme", 1],
        ["beta", 0],
      ]);
      presenter.selectTenant("beta");
      expect(presenter.vm.models).toEqual([]);
    });
  });
});
