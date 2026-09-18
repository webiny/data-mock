import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { listSeedJobsRoute } from "~/shared/routes/seeding.js";
import { SeedHistoryPresentationFeature } from "../feature.js";
import { SeedHistoryPresenter } from "../abstractions/SeedHistoryPresenter.js";

const SEED_JOBS_PATH = listSeedJobsRoute.path;
const REF = { projectId: "p1", environmentId: "e1" };

function makeSeedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "j1",
    projectId: "p1",
    environmentId: "e1",
    status: "completed",
    config: { tenant: "root", models: [{ modelId: "article", amount: 5 }] },
    result: { created: 5, errors: [] },
    createdAt: 10,
    ...overrides,
  };
}

describe("SeedHistoryPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    HTTPClientFeature.register(container, { baseUrl: "" });
    SeedHistoryPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);

    http.data.set(SEED_JOBS_PATH, [makeSeedJob()]);
  });

  function presenter() {
    return container.resolve(SeedHistoryPresenter);
  }

  it("counts the models a run covered and the entries it created", async () => {
    http.data.set(SEED_JOBS_PATH, [
      makeSeedJob({
        config: {
          tenant: "root",
          models: [
            { modelId: "article", amount: 5 },
            { modelId: "author", amount: 2 },
          ],
        },
        result: { created: 7, errors: [] },
      }),
    ]);

    const p = presenter();
    await p.load(REF);

    expect(p.vm.jobs[0]).toMatchObject({ modelCount: 2, created: 7, errors: 0 });
  });

  it("counts the errors of a run that partly failed", async () => {
    http.data.set(SEED_JOBS_PATH, [
      makeSeedJob({
        status: "failed",
        result: { created: 3, errors: ["one", "two"] },
      }),
    ]);

    const p = presenter();
    await p.load(REF);

    expect(p.vm.jobs[0]).toMatchObject({ status: "failed", created: 3, errors: 2 });
  });

  it("reads a run with no result yet as nothing created", async () => {
    http.data.set(SEED_JOBS_PATH, [makeSeedJob({ status: "running", result: null })]);

    const p = presenter();
    await p.load(REF);

    expect(p.vm.jobs[0]).toMatchObject({ created: 0, errors: 0 });
  });

  it("says why the history is empty when it could not be read", async () => {
    http.failures.set(SEED_JOBS_PATH, "gateway timeout");

    const p = presenter();
    await p.load(REF);

    expect(p.vm.error).toContain("gateway timeout");
    // Not "no seed jobs yet": that is a different answer.
    expect(p.vm.isEmpty).toBe(false);
  });

  it("is empty only once loading has finished", async () => {
    http.data.set(SEED_JOBS_PATH, []);

    const p = presenter();
    const loading = p.load(REF);

    // Nothing to show yet is not the same as nothing to show.
    expect(p.vm.isEmpty).toBe(false);

    await loading;

    expect(p.vm.isEmpty).toBe(true);
    expect(p.vm.isLoading).toBe(false);
  });
});
