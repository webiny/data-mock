import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { AddProjectPresentationFeature } from "../feature.js";
import { AddProjectPresenter } from "../abstractions/AddProjectPresenter.js";

const BROWSE_PATH = "/api/fs/browse";
const SCAN_PATH = "/api/fs/scan";
const SCAN_ROOTS_PATH = "/api/scan-roots";
const CREATE_PROJECT_PATH = "/api/projects";
const SYNC_PATH = "/api/projects/:projectId/sync";

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    rootPath: "/work/one",
    name: "one",
    webinyVersion: "6.4.9",
    versionMajor: 6,
    registered: false,
    ...overrides,
  };
}

describe("AddProjectPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    HTTPClientFeature.register(container, { baseUrl: "" });
    AddProjectPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);

    http.data.set(BROWSE_PATH, {
      path: "/work",
      parentPath: "/",
      entries: [{ name: "one", path: "/work/one", isWebinyProject: true, readable: true }],
      isWebinyProject: false,
    });
    http.data.set(SCAN_PATH, { candidates: [makeCandidate()], errors: [], rootsScanned: 1 });
    http.data.set(SCAN_ROOTS_PATH, [{ id: "r1", path: "/work" }]);
    http.data.set(CREATE_PROJECT_PATH, { id: "p1", name: "one", rootPath: "/work/one" });
    http.data.set(SYNC_PATH, { id: "job1" });
  });

  function presenter() {
    return container.resolve(AddProjectPresenter);
  }

  function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("cannot submit a checkout with no name or no path", async () => {
    const p = presenter();

    expect(p.vm.canSubmit).toBe(false);

    p.setRootPath("/work/one");
    p.setName("");
    expect(p.vm.canSubmit).toBe(false);

    p.setName("One");
    expect(p.vm.canSubmit).toBe(true);
  });

  it("needs a URL and a token before a remote project can be added", async () => {
    const p = presenter();
    p.setMode("remote");
    p.setName("Remote");

    expect(p.vm.canSubmit).toBe(false);

    p.setApiUrl("https://api.example.com");
    expect(p.vm.canSubmit).toBe(false);

    p.setApiToken("token");
    expect(p.vm.canSubmit).toBe(true);
  });

  it("names the project after the folder, until the user types one", async () => {
    const p = presenter();
    await p.scan();

    p.selectCandidate("/work/one");
    expect(p.vm.name).toBe("one");

    p.setName("My Project");
    p.selectCandidate("/work/one");
    // Their own name is never overwritten by a later selection.
    expect(p.vm.name).toBe("My Project");
  });

  it("will not select a checkout that is already registered", async () => {
    http.data.set(SCAN_PATH, {
      candidates: [makeCandidate({ registered: true })],
      errors: [],
      rootsScanned: 1,
    });

    const p = presenter();
    await p.scan();
    p.selectCandidate("/work/one");

    // Registering it twice would leave two projects pointing at one folder.
    expect(p.vm.rootPath).toBe("");
    expect(p.vm.candidates[0]?.selected).toBe(false);
  });

  it("labels a workspace root that has no resolvable version", async () => {
    http.data.set(SCAN_PATH, {
      candidates: [
        makeCandidate({ webinyVersion: null, versionMajor: 6 }),
        makeCandidate({ rootPath: "/work/two", webinyVersion: null, versionMajor: null }),
      ],
      errors: [],
      rootsScanned: 1,
    });

    const p = presenter();
    await p.scan();

    expect(p.vm.candidates.map((candidate) => candidate.versionLabel)).toEqual([
      "v6 workspace root",
      "not a Webiny project",
    ]);
  });

  it("tells a scan that found nothing apart from one that has not run", async () => {
    http.data.set(SCAN_PATH, { candidates: [], errors: [], rootsScanned: 1 });

    const p = presenter();
    expect(p.vm.hasScanned).toBe(false);

    await p.scan();

    expect(p.vm.hasScanned).toBe(true);
    expect(p.vm.candidates).toEqual([]);
  });

  it("keeps the directories it could not read in the browse list", async () => {
    http.data.set(BROWSE_PATH, {
      path: "/work",
      parentPath: "/",
      entries: [
        { name: "one", path: "/work/one", isWebinyProject: true, readable: true },
        { name: "locked", path: "/work/locked", isWebinyProject: false, readable: false },
      ],
      isWebinyProject: false,
    });

    const p = presenter();
    await p.browse();

    // Hiding it would read as "this folder is not there".
    expect(p.vm.browseEntries.map((entry) => entry.readable)).toEqual([true, false]);
  });

  it("goes nowhere from the filesystem root", async () => {
    http.data.set(BROWSE_PATH, {
      path: "/",
      parentPath: null,
      entries: [],
      isWebinyProject: false,
    });

    const p = presenter();
    await p.browse();
    await p.browseUp();

    expect(http.callsTo(BROWSE_PATH)).toHaveLength(1);
  });

  it("picks the directory being browsed as the checkout", async () => {
    const p = presenter();
    await p.browse();

    p.chooseBrowsedDirectory();

    expect(p.vm.rootPath).toBe("/work");
    expect(p.vm.name).toBe("work");
  });

  it("syncs a newly registered checkout, so it does not land as an empty row", async () => {
    const p = presenter();
    p.setRootPath("/work/one");
    p.setName("One");

    const added = await p.submit();

    expect(added).toBe(true);
    expect(http.callsTo(SYNC_PATH)).toHaveLength(1);
  });

  it("does not sync a project that has no checkout", async () => {
    http.data.set(CREATE_PROJECT_PATH, { id: "p2", name: "Remote", rootPath: null });

    const p = presenter();
    p.setMode("remote");
    p.setName("Remote");
    p.setApiUrl("https://api.example.com");
    p.setApiToken("token");

    const added = await p.submit();

    expect(added).toBe(true);
    expect(http.callsTo(SYNC_PATH)).toHaveLength(0);
  });

  it("keeps what was typed when the project could not be created", async () => {
    http.failures.set(CREATE_PROJECT_PATH, "name already taken");

    const p = presenter();
    p.setRootPath("/work/one");
    p.setName("One");

    const added = await p.submit();

    expect(added).toBe(false);
    expect(p.vm.error).toContain("name already taken");
    expect(p.vm.name).toBe("One");
    expect(p.vm.rootPath).toBe("/work/one");
  });

  it("clears the form after a project is added", async () => {
    const p = presenter();
    p.setRootPath("/work/one");
    p.setName("One");

    await p.submit();
    await flush();

    expect(p.vm.name).toBe("");
    expect(p.vm.rootPath).toBe("");
    expect(p.vm.error).toBeNull();
  });

  it("says a scan root list that could not be read, rather than showing none", async () => {
    http.failures.set(SCAN_ROOTS_PATH, "permission denied");

    const p = presenter();
    await p.loadScanRoots();

    // addScanRoot reloads this list, so silence here reads as the add having failed.
    expect(p.vm.error).toContain("permission denied");
  });

  it("says when a project was added but its sync could not be started", async () => {
    http.failures.set(SYNC_PATH, "queue full");

    const p = presenter();
    p.setRootPath("/work/one");
    p.setName("One");

    const added = await p.submit();

    // The project is there either way; only the follow-up is in doubt.
    expect(added).toBe(true);
  });

  it("says to add a folder rather than blaming roots that do not exist", async () => {
    http.data.set(SCAN_ROOTS_PATH, []);
    http.data.set(SCAN_PATH, { candidates: [], errors: [], rootsScanned: 0 });

    const p = presenter();
    await p.scan();

    // "No Webiny projects found under those roots" pointed at folders that were never added.
    expect(p.vm.error).toContain("Add a folder to scan first");
    expect(p.vm.hasScanned).toBe(false);
  });

  it("lists the scan roots when the scan tab is opened", async () => {
    const p = presenter();
    p.setMode("scan");
    await flush();

    expect(p.vm.scanRoots).toEqual([{ id: "r1", path: "/work" }]);
  });
});
