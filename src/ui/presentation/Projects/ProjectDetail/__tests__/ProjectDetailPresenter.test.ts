import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { StubHttpClient, stubListStateFactory } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { URLListStateFactory } from "~/ui/features/router/abstractions/URLListState.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { ProjectDetailPresentationFeature } from "../feature.js";
import { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import type { Project, ProjectEnvironment, ProjectStack } from "~/shared/types.js";

const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: "Project One",
    rootPath: "/work/project-one",
    webinyVersion: "6.4.9",
    versionSource: "package-json",
    versionMajor: 6,
    operationsVersion: "6.0.0",
    pulumiBackend: null,
    awsProfile: null,
    awsRegion: null,
    lastSyncedAt: null,
    lastSyncStatus: null,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeEnvironment(overrides: Partial<ProjectEnvironment> = {}): ProjectEnvironment {
  return {
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
    lastSyncedAt: 5,
    archivedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeStack(overrides: Partial<ProjectStack> = {}): ProjectStack {
  return {
    id: "s1",
    environmentId: ENVIRONMENT_ID,
    app: "core",
    deployed: true,
    resourceCount: 42,
    stackOutput: {},
    readState: "deployed",
    syncedAt: 5,
    ...overrides,
  };
}

const ENVIRONMENTS_PATH = "/api/projects/:projectId/environments";
const STACKS_PATH = "/api/projects/:projectId/environments/:environmentId/stacks";
const DEPLOYABLE_PATH = "/api/projects/:projectId/deployable-apps";
const DEPLOY_PATH = "/api/projects/:projectId/environments/:environmentId/deploy";
const DESTROY_PATH = "/api/projects/:projectId/environments/:environmentId/destroy";
const IMPACT_PATH = "/api/projects/:projectId/environments/:environmentId/deletion-impact";
const ARCHIVE_PATH = "/api/projects/:projectId/environments/:environmentId";
const PURGE_PATH = "/api/projects/:projectId/environments/:environmentId/purge";
const RESTORE_PATH = "/api/projects/:projectId/environments/:environmentId/restore";
const EMPTY_IMPACT = {
  environments: 0,
  stacks: 0,
  tenants: 0,
  groups: 0,
  models: 0,
  files: 0,
  seedJobs: 0,
  seedEntries: 0,
  syncLogs: 0,
  jobs: 0,
  seedTemplates: 0,
};
const HEALTH_PATH = "/api/projects/:projectId/environments/:environmentId/health";
const TENANT_PULL_PATH = "/api/projects/:projectId/environments/:environmentId/tenants/pull";

describe("ProjectDetailPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    // Registered first with a context of its own: the presentation feature pulls it in as a
    // dependency, and a dependency is registered without one.
    HTTPClientFeature.register(container, { baseUrl: "" });
    ProjectDetailPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    container.registerInstance(URLListStateFactory, stubListStateFactory());

    http.data.set("/api/projects/:id", makeProject());
    http.data.set(ENVIRONMENTS_PATH, [makeEnvironment()]);
    http.data.set(STACKS_PATH, [makeStack()]);
    http.data.set(DEPLOYABLE_PATH, { apps: ["core", "api", "admin"], versionMajor: 6 });
    http.data.set(HEALTH_PATH, { reachable: true, error: null });
    http.data.set(IMPACT_PATH, EMPTY_IMPACT);
    http.data.set(ARCHIVE_PATH, makeEnvironment({ archivedAt: 999 }));
    http.data.set(RESTORE_PATH, makeEnvironment());
  });

  function presenter() {
    return container.resolve(ProjectDetailPresenter);
  }

  /** Lets the gateway promise chains behind a fire-and-forget call settle. */
  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function loaded() {
    const p = presenter();
    await p.load(PROJECT_ID, null);
    return p;
  }

  it("selects the only environment when the URL names none", async () => {
    const p = await loaded();

    expect(p.vm.currentEnvironment?.stackName).toBe("dev");
    expect(p.vm.environmentError).toBeNull();
  });

  it("says why the page is blank when the project could not be read", async () => {
    http.failures.set("/api/projects/:id", "project not found");

    const p = await loaded();

    // Otherwise the whole page frame renders around a project that was never there.
    expect(p.vm.loadError).toContain("project not found");
    expect(p.vm.project).toBeNull();
  });

  it("says what to do when a project has no environments", async () => {
    http.data.set(ENVIRONMENTS_PATH, []);

    const p = await loaded();

    expect(p.vm.currentEnvironment).toBeNull();
    expect(p.vm.environmentError).toContain("Sync it to discover them");
  });

  it("never auto-selects an archived environment", async () => {
    http.data.set(ENVIRONMENTS_PATH, [makeEnvironment({ archivedAt: 999 })]);

    const p = await loaded();

    expect(p.vm.currentEnvironment).toBeNull();
    expect(p.vm.archivedEnvironments).toHaveLength(1);
  });

  describe("deployment dialog", () => {
    it("opens a deploy on review, ready to confirm once the apps are known", async () => {
      const p = await loaded();
      p.openDeploymentDialog("deploy");
      await flush();

      const dialog = p.vm.deploymentDialog;
      expect(dialog.isOpen).toBe(true);
      expect(dialog.command).toBe("deploy");
      expect(dialog.step).toBe("review");
      expect(dialog.deployableApps).toEqual(["core", "api", "admin"]);
      expect(dialog.canConfirm).toBe(true);
      expect(dialog.typedName).toBe("");
    });

    it("refuses a destroy until the project name is typed back exactly", async () => {
      const p = await loaded();
      p.openDeploymentDialog("destroy");
      await flush();

      expect(p.vm.deploymentDialog.canConfirm).toBe(false);

      p.setDeploymentTypedName("project one");
      expect(p.vm.deploymentDialog.canConfirm).toBe(false);

      p.setDeploymentTypedName("Project One");
      expect(p.vm.deploymentDialog.canConfirm).toBe(true);
    });

    it("shows what a destroy would tear down, with an unreadable stack counted as unknown", async () => {
      http.data.set(STACKS_PATH, [
        makeStack({ app: "core", resourceCount: 42 }),
        makeStack({ id: "s2", app: "api", readState: "unknown", resourceCount: 9, deployed: true }),
      ]);

      const p = await loaded();
      await p.activateView("system");
      p.openDeploymentDialog("destroy");
      await flush();
      p.toggleDeploymentApp("core");
      p.toggleDeploymentApp("api");

      expect(p.vm.deploymentDialog.atRisk).toEqual([
        { app: "core", resourceCount: 42, deployed: true },
        // Never zero: a stack that could not be read is not a stack with nothing in it.
        { app: "api", resourceCount: null, deployed: true },
      ]);
    });

    it("sends the selected apps, region and preview flag on a deploy", async () => {
      const p = await loaded();
      p.openDeploymentDialog("deploy");
      await flush();
      p.toggleDeploymentApp("api");
      p.setDeploymentRegion("us-east-1");
      p.toggleDeploymentPreview();

      await p.submitDeployment();

      expect(http.callsTo(DEPLOY_PATH)[0]?.body).toEqual({
        apps: ["api"],
        region: "us-east-1",
        preview: true,
      });
      expect(p.vm.deploymentDialog.isOpen).toBe(false);
    });

    it("sends the typed project name on a destroy, for the server to check again", async () => {
      const p = await loaded();
      p.openDeploymentDialog("destroy");
      await flush();
      p.setDeploymentTypedName(" Project One ");

      await p.submitDeployment();

      expect(http.callsTo(DESTROY_PATH)[0]?.body).toEqual({ confirmProjectName: "Project One" });
    });

    it("keeps the dialog open and reports why when the run cannot be started", async () => {
      http.failures.set(DEPLOY_PATH, "project busy");

      const p = await loaded();
      p.openDeploymentDialog("deploy");
      await flush();

      await p.submitDeployment();

      expect(p.vm.deploymentDialog.isOpen).toBe(true);
      expect(p.vm.deploymentDialog.error).toContain("project busy");
    });

    it("forgets the typed name and selection when the dialog is closed", async () => {
      const p = await loaded();
      p.openDeploymentDialog("destroy");
      await flush();
      p.setDeploymentTypedName("Project One");
      p.toggleDeploymentApp("core");

      p.closeDeploymentDialog();
      p.openDeploymentDialog("destroy");
      await flush();

      expect(p.vm.deploymentDialog.typedName).toBe("");
      expect(p.vm.deploymentDialog.selectedApps).toEqual([]);
      expect(p.vm.deploymentDialog.canConfirm).toBe(false);
    });
  });

  describe("live logs", () => {
    it("collects the lines of a running job in order", async () => {
      const p = await loaded();
      const bridge = container.resolve(EventBridge);

      bridge.emit("job:log", { jobId: "j1", projectId: PROJECT_ID, line: "first" });
      bridge.emit("job:log", { jobId: "j1", projectId: PROJECT_ID, line: "second" });

      expect(p.liveLogsFor("j1")).toBe("first\nsecond");
    });

    it("keeps each job's lines apart", async () => {
      const p = await loaded();
      const bridge = container.resolve(EventBridge);

      bridge.emit("job:log", { jobId: "j1", projectId: PROJECT_ID, line: "from one" });
      bridge.emit("job:log", { jobId: "j2", projectId: PROJECT_ID, line: "from two" });

      expect(p.liveLogsFor("j1")).toBe("from one");
      expect(p.liveLogsFor("j2")).toBe("from two");
    });

    it("ignores a job belonging to another project", async () => {
      const p = await loaded();
      const bridge = container.resolve(EventBridge);

      bridge.emit("job:log", { jobId: "j1", projectId: "other", line: "not ours" });

      expect(p.liveLogsFor("j1")).toBe("");
    });

    it("keeps only the tail of a long deploy", async () => {
      const p = await loaded();
      const bridge = container.resolve(EventBridge);

      for (let index = 0; index < 2500; index++) {
        bridge.emit("job:log", { jobId: "j1", projectId: PROJECT_ID, line: `line ${index}` });
      }

      const lines = p.liveLogsFor("j1").split("\n");
      expect(lines).toHaveLength(2000);
      // The tail is kept, not the head: the end of a deploy is what matters.
      expect(lines[lines.length - 1]).toBe("line 2499");
    });
  });

  describe("system info", () => {
    it("says why the panel is thin when the environment has never been synced", async () => {
      http.data.set(STACKS_PATH, []);

      const p = await loaded();
      await p.activateView("system");

      expect(p.vm.systemInfoNotice).toContain("never been synced");
      // The CMS endpoints are derived from the environment's own URL, so they survive with no
      // stack output at all.
      expect(p.vm.systemInfo.flatMap((section) => section.items)).not.toEqual([]);
    });

    it("says why the panel is empty when no environment is selected", async () => {
      http.data.set(ENVIRONMENTS_PATH, []);

      const p = await loaded();

      expect(p.vm.systemInfo).toEqual([]);
      expect(p.vm.systemInfoNotice).toBe("No environment selected.");
    });

    it("reads the stored stack output rather than the network", async () => {
      http.data.set(STACKS_PATH, [
        makeStack({
          app: "core",
          stackOutput: { primaryDynamodbTableName: "wby-core-dev", cognitoUserPoolId: "eu-1_abc" },
        }),
      ]);

      const p = await loaded();
      await p.activateView("system");

      const values = p.vm.systemInfo.flatMap((section) => section.items.map((item) => item.value));
      expect(values).toContain("wby-core-dev");
      expect(p.vm.stacks[0]?.rawOutput).toContain("primaryDynamodbTableName");
    });

    it("never reports an unreadable stack as not deployed", async () => {
      http.data.set(STACKS_PATH, [
        makeStack({ app: "core", readState: "unknown", resourceCount: null }),
      ]);

      const p = await loaded();
      await p.activateView("system");

      expect(p.vm.stacks[0]?.stateLabel).toBe("Could not read");
    });
  });

  describe("removing an environment", () => {
    it("opens in the reversible mode with the impact of a purge on screen", async () => {
      http.data.set(IMPACT_PATH, { ...EMPTY_IMPACT, seedEntries: 1674, syncLogs: 3 });

      const p = await loaded();
      p.confirmRemoveEnvironment(ENVIRONMENT_ID, "dev");
      await flush();

      const confirmation = p.vm.environmentDeleteConfirmation;
      expect(confirmation.isOpen).toBe(true);
      expect(confirmation.mode).toBe("archive");
      expect(confirmation.impactTotal).toBe(1677);
    });

    it("archives without touching anything that hangs off the environment", async () => {
      const p = await loaded();
      p.confirmRemoveEnvironment(ENVIRONMENT_ID, "dev");
      await flush();

      await p.archiveEnvironment();

      // Same path as reading one environment, so the method is what distinguishes it.
      expect(http.callsTo(ARCHIVE_PATH, "DELETE")).toHaveLength(1);
      expect(http.callsTo(PURGE_PATH)).toHaveLength(0);
      expect(p.vm.environmentDeleteConfirmation.isOpen).toBe(false);
    });

    it("purges nothing until the confirmation has been moved to purge", async () => {
      const p = await loaded();
      p.confirmRemoveEnvironment(ENVIRONMENT_ID, "dev");
      await flush();

      // The first step is the reversible one; a purge from there destroys data with one click.
      await p.purgeEnvironment();
      expect(http.callsTo(PURGE_PATH)).toHaveLength(0);

      p.requestPurgeEnvironment();
      expect(p.vm.environmentDeleteConfirmation.mode).toBe("purge");

      await p.purgeEnvironment();
      expect(http.callsTo(PURGE_PATH)).toHaveLength(1);
    });

    it("stops addressing an environment it just purged", async () => {
      const p = await loaded();
      expect(p.vm.currentEnvironment?.id).toBe(ENVIRONMENT_ID);

      p.confirmRemoveEnvironment(ENVIRONMENT_ID, "dev");
      await flush();
      p.requestPurgeEnvironment();
      http.data.set(ENVIRONMENTS_PATH, []);

      await p.purgeEnvironment();

      expect(p.vm.currentEnvironment).toBeNull();
    });

    it("keeps the environment when the purge fails", async () => {
      http.failures.set(PURGE_PATH, "environment is busy");

      const p = await loaded();
      p.confirmRemoveEnvironment(ENVIRONMENT_ID, "dev");
      await flush();
      p.requestPurgeEnvironment();

      await p.purgeEnvironment();

      expect(p.vm.currentEnvironment?.id).toBe(ENVIRONMENT_ID);
    });

    it("restores an archived environment", async () => {
      http.data.set(ENVIRONMENTS_PATH, [makeEnvironment({ archivedAt: 999 })]);

      const p = await loaded();
      expect(p.vm.archivedEnvironments).toHaveLength(1);

      http.data.set(ENVIRONMENTS_PATH, [makeEnvironment()]);
      await p.restoreEnvironment(ENVIRONMENT_ID);

      expect(http.callsTo(RESTORE_PATH)).toHaveLength(1);
      expect(p.vm.archivedEnvironments).toEqual([]);
    });
  });

  describe("confirmations", () => {
    it("pulls no tenants until the confirmation is accepted", async () => {
      const p = await loaded();

      p.pullTenants();

      expect(p.vm.confirmation.isOpen).toBe(true);
      expect(http.callsTo(TENANT_PULL_PATH)).toHaveLength(0);

      await p.confirmAction();

      expect(http.callsTo(TENANT_PULL_PATH)).toHaveLength(1);
      expect(p.vm.confirmation.isOpen).toBe(false);
    });

    it("pulls nothing when the confirmation is dismissed", async () => {
      const p = await loaded();

      p.pullTenants();
      p.cancelAction();
      await p.confirmAction();

      expect(http.callsTo(TENANT_PULL_PATH)).toHaveLength(0);
    });
  });
});
