import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { autorun } from "mobx";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import type { ProjectFile } from "~/shared/types.js";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import { FilesTabFeature } from "../feature.js";
import { FilesTabPresenter } from "../abstractions/FilesTabPresenter.js";

const FILES_PATH = "/api/projects/:projectId/environments/:environmentId/files";
const LOCAL_FILES_PATH = "/api/files/local";
const UPLOAD_PATH = "/api/projects/:projectId/environments/:environmentId/files/upload";
const DELETE_PATH = "/api/projects/:projectId/environments/:environmentId/files/:fileId";
const PULL_PATH = "/api/projects/:projectId/environments/:environmentId/files/pull";
const UPLOAD_GLOBAL_PATH =
  "/api/projects/:projectId/environments/:environmentId/files/upload-global";

const PROJECT_ID = "p1";
const ENVIRONMENT_ID = "e1";

const CONTEXT: ProjectDetailTabContext = {
  projectId: PROJECT_ID,
  ref: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID },
  envName: "dev",
  tenant: "root",
};

function projectFile(fileName: string, id = fileName): ProjectFile {
  return {
    id,
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    tenant: "root",
    fileKey: `files/${fileName}`,
    fileUrl: `https://cdn.example.com/${fileName}`,
    fileName,
    fileType: "image/png",
    fileSize: 1024,
    uploadedAt: 1,
  };
}

/**
 * Node has no `FileReader`; the presenter's base64 helper needs one to turn a dropped `File` into
 * upload content. This mirrors just enough of the browser API — `readAsDataURL`, `onload`,
 * `onerror`, `result`, `error` — for that helper to run against Node's own `File`/`Blob`, which do
 * support `arrayBuffer()`.
 */
class FakeFileReader {
  public result: string | null = null;
  public error: Error | null = null;
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  public readAsDataURL(file: File): void {
    file
      .arrayBuffer()
      .then((buffer) => {
        this.result = `data:${file.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.();
      })
      .catch((error: unknown) => {
        this.error = error instanceof Error ? error : new Error(String(error));
        this.onerror?.();
      });
  }
}

describe("FilesTabPresenter", () => {
  let container: Container;
  let http: StubHttpClient;
  let presenter: FilesTabPresenter.Interface;
  let originalFileReader: unknown;

  beforeEach(() => {
    originalFileReader = (globalThis as { FileReader?: unknown }).FileReader;
    (globalThis as { FileReader?: unknown }).FileReader = FakeFileReader;

    container = new Container();
    http = new StubHttpClient();
    HTTPClientFeature.register(container, { baseUrl: "" });
    FilesTabFeature.register(container);
    container.registerInstance(HTTPClient, http.client);
    http.data.set(FILES_PATH, []);
    http.data.set(LOCAL_FILES_PATH, []);
    presenter = FilesTabFeature.resolve(container).presenter;
  });

  afterEach(() => {
    (globalThis as { FileReader?: unknown }).FileReader = originalFileReader;
  });

  it("reads nothing until an environment is resolved", async () => {
    await presenter.activate({ ...CONTEXT, ref: null });

    expect(http.calls).toHaveLength(0);
    expect(presenter.vm.mergedFiles).toEqual([]);
  });

  it("reads once the environment arrives, and shows what it read to an observer", async () => {
    http.data.set(FILES_PATH, [projectFile("hero.png")]);
    const seen: number[] = [];
    const stop = autorun(() => seen.push(presenter.vm.mergedFiles.length));

    await presenter.activate({ ...CONTEXT, ref: null });
    await presenter.activate(CONTEXT);

    expect(seen.at(-1)).toBe(1);
    expect(presenter.vm.mergedFiles[0]?.fileName).toBe("hero.png");
    expect(presenter.vm.mergedFiles[0]?.source).toBe("project");
    stop();
  });

  it("reads once for the same context", async () => {
    await presenter.activate(CONTEXT);
    await presenter.activate(CONTEXT);

    expect(http.callsTo(FILES_PATH)).toHaveLength(1);
    expect(http.callsTo(LOCAL_FILES_PATH)).toHaveLength(1);
  });

  it("asks again after a failed read, rather than staying blank", async () => {
    http.failures.set(FILES_PATH, "gateway down");

    await presenter.activate(CONTEXT);
    expect(presenter.vm.mergedFiles).toEqual([]);

    http.failures.delete(FILES_PATH);
    http.data.set(FILES_PATH, [projectFile("hero.png")]);
    await presenter.activate(CONTEXT);

    expect(presenter.vm.mergedFiles).toHaveLength(1);
  });

  it("reads again when a job that writes files finishes", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(FILES_PATH, [projectFile("hero.png")]);

    const bridge = container.resolve(EventBridge);
    bridge.emit("job:status", {
      jobId: "j1",
      projectId: PROJECT_ID,
      type: "upload-files",
      status: "completed",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(presenter.vm.mergedFiles).toHaveLength(1);
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
    await Promise.resolve();

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
      type: "upload-files",
      status: "completed",
    });
    await Promise.resolve();

    expect(http.calls).toHaveLength(before);
  });

  it("merges the global pool behind the files a project already has, badged apart", async () => {
    http.data.set(FILES_PATH, [projectFile("shared.png")]);
    http.data.set(LOCAL_FILES_PATH, [
      { fileName: "shared.png", fileType: "image/png", fileSize: 10, uploadedToProjects: [] },
      { fileName: "extra.png", fileType: "image/png", fileSize: 20, uploadedToProjects: [] },
    ]);

    await presenter.activate(CONTEXT);

    expect(presenter.vm.mergedFiles.map((file) => file.fileName)).toEqual([
      "shared.png",
      "extra.png",
    ]);
    expect(presenter.vm.mergedFiles[0]?.badges).toEqual([{ label: "project", color: "blue" }]);
    expect(presenter.vm.mergedFiles[1]?.badges).toEqual([{ label: "global", color: "gray" }]);
  });

  it("deletes a file, removing it from the merged list", async () => {
    http.data.set(FILES_PATH, [projectFile("hero.png", "f1")]);
    await presenter.activate(CONTEXT);
    expect(presenter.vm.mergedFiles).toHaveLength(1);

    await presenter.deleteFile("f1");

    expect(http.callsTo(DELETE_PATH)).toHaveLength(1);
    expect(presenter.vm.mergedFiles).toEqual([]);
  });

  it("uploads a dropped file to the project, then rereads the dataset", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(UPLOAD_PATH, projectFile("dropped.png"));

    const file = new File(["content"], "dropped.png", { type: "image/png" });
    http.data.set(FILES_PATH, [projectFile("dropped.png")]);

    await presenter.uploadFilesToProject([file]);

    expect(http.callsTo(UPLOAD_PATH)).toHaveLength(1);
    expect(http.callsTo(FILES_PATH)).toHaveLength(2);
    expect(presenter.vm.mergedFiles).toHaveLength(1);
    expect(presenter.vm.mergedFiles[0]?.fileName).toBe("dropped.png");
  });

  it("uploads what it can when one of several files fails to read, and still rereads", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(UPLOAD_PATH, projectFile("good.png"));

    const goodFile = new File(["content"], "good.png", { type: "image/png" });
    const badFile = new File(["content"], "bad.png", { type: "image/png" });
    Object.defineProperty(badFile, "arrayBuffer", {
      value: () => Promise.reject(new Error("disk read error")),
    });

    http.data.set(FILES_PATH, [projectFile("good.png")]);

    await presenter.uploadFilesToProject([goodFile, badFile]);

    // Only the file that could be read reaches the upload call; the other is reported as a
    // failure without ever hitting the network.
    expect(http.callsTo(UPLOAD_PATH)).toHaveLength(1);
    expect(http.callsTo(FILES_PATH)).toHaveLength(2);
    expect(presenter.vm.mergedFiles.map((file) => file.fileName)).toEqual(["good.png"]);
  });

  it("starts a global upload job and reflects the loading state while it runs", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(UPLOAD_GLOBAL_PATH, { id: "job1", type: "upload-files" });

    const pending = presenter.uploadAllGlobalImages();
    expect(presenter.vm.isUploadingGlobal).toBe(true);
    await pending;

    expect(presenter.vm.isUploadingGlobal).toBe(false);
    expect(http.callsTo(UPLOAD_GLOBAL_PATH)).toHaveLength(1);
  });

  it("uploads only the selected global images", async () => {
    await presenter.activate(CONTEXT);
    http.data.set(UPLOAD_GLOBAL_PATH, { id: "job1", type: "upload-files" });

    await presenter.uploadSelectedGlobalImages(["a.png", "b.png"]);

    expect(http.callsTo(UPLOAD_GLOBAL_PATH)).toHaveLength(1);
    expect(http.callsTo(UPLOAD_GLOBAL_PATH)[0]?.body).toEqual({
      tenant: "root",
      fileNames: ["a.png", "b.png"],
    });
  });

  it("does nothing when asked to upload an empty selection", async () => {
    await presenter.activate(CONTEXT);

    await presenter.uploadSelectedGlobalImages([]);

    expect(http.callsTo(UPLOAD_GLOBAL_PATH)).toHaveLength(0);
  });

  it("asks for confirmation before pulling files, and does not pull until confirmed", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullFiles();

    expect(presenter.vm.confirmation.isOpen).toBe(true);
    expect(http.callsTo(PULL_PATH)).toHaveLength(0);

    http.data.set(PULL_PATH, { synced: 3 });
    await presenter.confirmAction();

    expect(http.callsTo(PULL_PATH)).toHaveLength(1);
    expect(presenter.vm.confirmation.isOpen).toBe(false);
    // A successful pull rereads the dataset.
    expect(http.callsTo(FILES_PATH)).toHaveLength(2);
  });

  it("cancels a pending pull without ever calling the gateway", async () => {
    await presenter.activate(CONTEXT);

    presenter.pullFiles();
    presenter.cancelAction();

    expect(presenter.vm.confirmation.isOpen).toBe(false);
    await presenter.confirmAction();

    expect(http.callsTo(PULL_PATH)).toHaveLength(0);
  });
});
