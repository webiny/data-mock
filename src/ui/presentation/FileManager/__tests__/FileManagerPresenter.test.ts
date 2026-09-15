import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { StubHttpClient } from "~/ui/testing/StubHttpClient.js";
import { FileManagerPresentationFeature } from "../feature.js";
import { FileManagerPresenter } from "../abstractions/FileManagerPresenter.js";

const LIST_PATH = "/api/files/local";
const PICSUM_PATH = "/api/files/picsum/pull";
const DELETE_PATH = "/api/files/local/:fileName";

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    fileName: "photo.jpg",
    fileType: "image/jpeg",
    fileSize: 1024,
    uploadedToProjects: [],
    ...overrides,
  };
}

describe("FileManagerPresenter", () => {
  let container: Container;
  let http: StubHttpClient;

  beforeEach(() => {
    container = new Container();
    http = new StubHttpClient();

    HTTPClientFeature.register(container, { baseUrl: "" });
    EventsFeature.register(container);
    NotificationsFeature.register(container);
    FileManagerPresentationFeature.register(container);
    container.registerInstance(HTTPClient, http.client);

    http.data.set(LIST_PATH, [makeFile()]);
    http.data.set(PICSUM_PATH, { id: "job1" });
  });

  function presenter() {
    return container.resolve(FileManagerPresenter);
  }

  it("marks a file that belongs to no project as global", async () => {
    const p = presenter();
    await p.load();

    expect(p.vm.files[0]?.badges).toEqual([{ label: "global", color: "gray" }]);
  });

  it("names every project a file was uploaded to", async () => {
    http.data.set(LIST_PATH, [
      makeFile({
        uploadedToProjects: [
          { projectId: "p1", projectName: "One" },
          { projectId: "p2", projectName: "Two" },
        ],
      }),
    ]);

    const p = presenter();
    await p.load();

    expect(p.vm.files[0]?.badges.map((badge) => badge.label)).toEqual(["One", "Two"]);
  });

  it("only treats an image as previewable", async () => {
    http.data.set(LIST_PATH, [
      makeFile({ fileName: "a.jpg", fileType: "image/jpeg" }),
      makeFile({ fileName: "b.pdf", fileType: "application/pdf" }),
    ]);

    const p = presenter();
    await p.load();

    expect(p.vm.files.map((file) => file.isImage)).toEqual([true, false]);
  });

  it("escapes a file name in the URL it builds", async () => {
    http.data.set(LIST_PATH, [makeFile({ fileName: "holiday photo #1.jpg" })]);

    const p = presenter();
    await p.load();

    expect(p.vm.files[0]?.thumbnailUrl).toBe("/api/files/local/holiday%20photo%20%231.jpg/content");
  });

  it("reports why the list is empty when it could not be read", async () => {
    http.failures.set(LIST_PATH, "server down");

    const p = presenter();
    await p.load();

    expect(p.vm.error).toContain("server down");
    expect(p.vm.files).toEqual([]);
  });

  it("downloads nothing until the confirmation is accepted", async () => {
    const p = presenter();
    await p.load();

    p.setPicsumCount(25);
    p.pullPicsum();

    expect(p.vm.confirmation.isOpen).toBe(true);
    // The count the user set is in the dialog, so it cannot be changed by the button they read.
    expect(p.vm.confirmation.message).toContain("25");
    expect(http.callsTo(PICSUM_PATH)).toHaveLength(0);

    await p.confirmAction();

    expect(http.callsTo(PICSUM_PATH)[0]?.body).toMatchObject({ count: 25 });
  });

  it("downloads nothing when the confirmation is dismissed", async () => {
    const p = presenter();
    await p.load();

    p.pullPicsum();
    p.cancelAction();
    await p.confirmAction();

    expect(http.callsTo(PICSUM_PATH)).toHaveLength(0);
  });

  it("opens and closes the preview of one file", async () => {
    const p = presenter();
    await p.load();

    const file = p.vm.files[0];
    if (file === undefined) {
      throw new Error("No file loaded");
    }

    p.openPreview(file);
    expect(p.vm.previewFile?.fileName).toBe("photo.jpg");

    p.closePreview();
    expect(p.vm.previewFile).toBeNull();
  });

  it("drops a deleted file from the list", async () => {
    const p = presenter();
    await p.load();

    await p.deleteFile("photo.jpg");

    expect(http.callsTo(DELETE_PATH)).toHaveLength(1);
    expect(p.vm.files).toEqual([]);
  });
});
