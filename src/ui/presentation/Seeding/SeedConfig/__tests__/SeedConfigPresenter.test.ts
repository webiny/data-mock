import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { SeedConfigPresentationFeature } from "../feature.js";
import { SeedConfigPresenter } from "../abstractions/SeedConfigPresenter.js";

const PROJECT_PATH = "/api/projects/:id";
const TENANTS_PATH = "/api/projects/:projectId/environments/:environmentId/tenants";
const MODELS_PATH = "/api/projects/:projectId/environments/:environmentId/models";
const SEED_PATH = "/api/projects/:projectId/environments/:environmentId/seed";

const REF = { projectId: "p1", environmentId: "e1" };

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    modelId: "article",
    name: "Article",
    tenant: "root",
    groupSlug: "content",
    singularApiName: "Article",
    pluralApiName: "Articles",
    description: null,
    fields: [],
    plugin: false,
    syncedAt: null,
    ...overrides,
  };
}

describe("SeedConfigPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    HTTPClientFeature.register(container, { baseUrl: "" });
    ProjectsFeature.register(container);
    SeedConfigPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);

    http.data.set(PROJECT_PATH, { id: "p1", name: "Project One" });
    http.data.set(TENANTS_PATH, [{ tenantId: "root", name: "Root" }]);
    http.data.set(MODELS_PATH, [makeModel(), makeModel({ modelId: "author", name: "Author" })]);
    http.data.set(SEED_PATH, { id: "job1" });
  });

  function presenter() {
    return container.resolve(SeedConfigPresenter);
  }

  function seedBody(): Record<string, unknown> {
    return http.callsTo(SEED_PATH)[0]?.body as Record<string, unknown>;
  }

  it("never offers a system model, and never seeds one", async () => {
    http.data.set(MODELS_PATH, [
      makeModel(),
      makeModel({ modelId: "wbyAcoSearchRecord", name: "Search record" }),
    ]);

    const p = presenter();
    await p.load(REF);

    const models = p.vm.groups.flatMap((group) => group.models);
    expect(models.map((model) => model.modelId)).toEqual(["article"]);

    p.selectAll();
    await p.confirmSeed();

    // selectAll selects every state, system ones included — the seed must still skip them.
    expect(seedBody()["models"]).toEqual([{ modelId: "article", amount: 10, revisions: 1 }]);
  });

  it("selects the first tenant so the form is usable straight away", async () => {
    http.data.set(TENANTS_PATH, [
      { tenantId: "root", name: "Root" },
      { tenantId: "other", name: "Other" },
    ]);

    const p = presenter();
    await p.load(REF);

    expect(p.vm.selectedTenant).toBe("root");
  });

  it("toggles a whole group off, then back on", async () => {
    const p = presenter();
    await p.load(REF);

    expect(p.vm.groups[0]?.allSelected).toBe(true);

    p.toggleGroup("content");
    expect(p.vm.groups[0]?.models.every((model) => !model.selected)).toBe(true);

    p.toggleGroup("content");
    expect(p.vm.groups[0]?.allSelected).toBe(true);
  });

  it("seeds a model with the global amount until it is overridden", async () => {
    const p = presenter();
    await p.load(REF);

    p.setGlobalAmount(7);
    p.toggleModelOverride("article");
    p.setAmount("article", 3);

    await p.confirmSeed();

    expect(seedBody()["models"]).toEqual([
      { modelId: "article", amount: 3, revisions: 1 },
      { modelId: "author", amount: 7, revisions: 1 },
    ]);
  });

  it("starts an override at the global values rather than blank", async () => {
    const p = presenter();
    await p.load(REF);

    p.setGlobalAmount(12);
    p.setGlobalRevisions("2-4");
    p.toggleModelOverride("article");

    const article = p.vm.groups
      .flatMap((group) => group.models)
      .find((model) => model.modelId === "article");
    expect(article).toMatchObject({ hasOverride: true, amount: 12, revisions: "2-4" });
  });

  it("hides an override's values again when it is turned off", async () => {
    const p = presenter();
    await p.load(REF);

    p.toggleModelOverride("article");
    p.setAmount("article", 9);
    p.toggleModelOverride("article");

    const article = p.vm.groups
      .flatMap((group) => group.models)
      .find((model) => model.modelId === "article");
    expect(article).toMatchObject({ hasOverride: false, amount: null, revisions: null });
  });

  it("reads a revision range, and a bad one as a single revision", async () => {
    const p = presenter();
    await p.load(REF);

    p.deselectAll();
    p.toggleModel("article");
    p.setGlobalRevisions("2-5");
    await p.confirmSeed();

    expect(seedBody()["models"]).toEqual([
      { modelId: "article", amount: 10, revisions: { min: 2, max: 5 } },
    ]);
  });

  it("refuses a seed with nothing selected", async () => {
    const p = presenter();
    await p.load(REF);

    p.deselectAll();
    await p.confirmSeed();

    expect(p.vm.error).toContain("at least one model");
    expect(http.callsTo(SEED_PATH)).toHaveLength(0);
  });

  it("asks before a real run, and not before a dry run", async () => {
    const p = presenter();
    await p.load(REF);

    p.setDryRun(false);
    p.requestSeed();
    expect(p.vm.showSeedConfirm).toBe(true);

    p.cancelSeed();
    expect(p.vm.showSeedConfirm).toBe(false);
    expect(http.callsTo(SEED_PATH)).toHaveLength(0);

    // A dry run creates nothing, so there is nothing to confirm.
    p.setDryRun(true);
    p.requestSeed();
    expect(p.vm.showSeedConfirm).toBe(false);
  });

  it("sends the batch size and publish settings chosen on the confirmation", async () => {
    const p = presenter();
    await p.load(REF);

    p.setBatchSize(25);
    p.setPublishStrategy("random");
    p.setPublishPercent(40);
    p.setIncludeUnpublish(true);

    await p.confirmSeed();

    expect(seedBody()).toMatchObject({
      batchSize: 25,
      publishStrategy: "random",
      publishPercent: 40,
      includeUnpublish: true,
    });
  });

  it("never sends an amount below one", async () => {
    const p = presenter();
    await p.load(REF);

    p.deselectAll();
    p.toggleModel("article");
    p.setGlobalAmount(0);
    await p.confirmSeed();

    expect(seedBody()["models"]).toEqual([{ modelId: "article", amount: 1, revisions: 1 }]);
  });

  it("reports a seed that could not be started, and does not claim it ran", async () => {
    http.failures.set(SEED_PATH, "environment not connectable");

    const p = presenter();
    await p.load(REF);
    await p.confirmSeed();

    expect(p.vm.error).toContain("environment not connectable");
    expect(p.vm.seedJobStarted).toBe(false);
  });

  describe("per tenant", () => {
    beforeEach(() => {
      http.data.set(TENANTS_PATH, [
        { tenantId: "root", name: "Root" },
        { tenantId: "acme", name: "Acme" },
      ]);
      http.data.set(MODELS_PATH, [
        makeModel(),
        makeModel({ modelId: "product", name: "Product", tenant: "acme" }),
      ]);
    });

    it("offers only the selected tenant's models", async () => {
      const p = presenter();
      await p.load(REF);

      const offered = () => p.vm.groups.flatMap((g) => g.models.map((m) => m.modelId));
      expect(offered()).toEqual(["article"]);

      p.setTenant("acme");
      expect(offered()).toEqual(["product"]);
    });

    it("seeds the selected tenant's models, never another tenant's", async () => {
      const p = presenter();
      await p.load(REF);
      p.setTenant("acme");
      p.setDryRun(true);

      p.requestSeed();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const body = seedBody();
      expect(body["tenant"]).toBe("acme");
      expect((body["models"] as Array<{ modelId: string }>).map((m) => m.modelId)).toEqual([
        "product",
      ]);
    });

    it("starts on a tenant that has models", async () => {
      http.data.set(MODELS_PATH, [makeModel({ tenant: "acme" })]);

      const p = presenter();
      await p.load(REF);

      expect(p.vm.selectedTenant).toBe("acme");
    });
  });
});
