import { describe, it, expect, beforeEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { ProjectDetailPresentationFeature } from "../feature.js";
import { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

describe("what an observer sees", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    ProjectDetailPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());

    http.data.set("/api/projects/:id", {
      id: PROJECT_ID,
      name: "webiny-v5",
      rootPath: "/work/webiny-v5",
      webinyVersion: "5.44.2",
      versionSource: "package-json",
      versionMajor: 5,
      operationsVersion: "6.0.0",
      pulumiBackend: null,
      awsProfile: null,
      awsRegion: null,
      lastSyncedAt: 1,
      lastSyncStatus: null,
      archivedAt: null,
      seeded: false,
      createdAt: 1,
      updatedAt: 1,
    });
    http.data.set("/api/projects/:projectId/environments", [
      {
        id: ENVIRONMENT_ID,
        projectId: PROJECT_ID,
        env: "dev",
        variant: "",
        region: "eu-central-1",
        deployed: true,
        apiUrl: "https://api.example.com",
        adminUrl: "https://admin.example.com",
        apiToken: null,
        tenant: "root",
        lastSyncedAt: 1,
        archivedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    http.data.set("/api/projects/:projectId/environments/:environmentId/stacks", [
      {
        id: "s1",
        environmentId: ENVIRONMENT_ID,
        app: "core",
        deployed: true,
        resourceCount: 20,
        stackOutput: {},
        readState: "deployed",
        syncedAt: 1,
      },
    ]);
    http.data.set("/api/projects/:projectId/environments/:environmentId/health", {
      reachable: true,
      error: null,
    });
  });

  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * An observer, which is what the page is. Without one a computed `vm` recomputes on every read,
   * so a test that only reads `presenter.vm` cannot tell a tracked dependency from an untracked
   * one — the view would be stale in the browser and the test green.
   */
  it("re-renders when the stacks arrive, without being remounted", async () => {
    const presenter = container.resolve(ProjectDetailPresenter);

    // Mounted before the data, which is the order the page runs in.
    const seen: number[] = [];
    const dispose = autorun(() => {
      seen.push(presenter.vm.stacks.length);
    });

    await presenter.load(PROJECT_ID, "dev");
    await presenter.activateView("environments");
    await flush();
    dispose();

    expect(seen[seen.length - 1]).toBe(1);
  });

  it("loads the open tab's data when the environment resolves after it was opened", async () => {
    const presenter = container.resolve(ProjectDetailPresenter);

    /**
     * What the page does: one effect loads the project, another activates the view without waiting
     * for it, so the tab is opened while the environment is still being resolved. The second
     * effect depends on the resolved environment, so it runs again once there is one — this is
     * that second run.
     */
    const pending = presenter.load(PROJECT_ID, "dev");
    await presenter.activateView("environments");
    await pending;
    await presenter.activateView("environments");
    await flush();

    expect(presenter.vm.stacks).toHaveLength(1);
  });

  it("re-renders when the environments arrive", async () => {
    const presenter = container.resolve(ProjectDetailPresenter);

    const seen: number[] = [];
    const dispose = autorun(() => {
      seen.push(presenter.vm.environments.length);
    });

    await presenter.load(PROJECT_ID, "dev");
    await flush();
    dispose();

    expect(seen[seen.length - 1]).toBe(1);
  });
});
