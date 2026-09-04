import { describe, it, expect, afterEach, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { PullPicsumImagesService } from "../abstractions/PullPicsumImagesService.js";
import { ListLocalImagesService } from "../abstractions/ListLocalImagesService.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isFile: () => true, size: 1000 }),
  };
});

const fs = await import("node:fs");

function makeFakeResponse(ok: boolean, status: number = 200): Response {
  return {
    ok,
    status,
    arrayBuffer: async () => new TextEncoder().encode("fake-image-bytes").buffer,
  } as Response;
}

describe("Picsum Feature", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
  });

  describe("PullPicsumImagesService", () => {
    it("should download images and write them to the images directory", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeFakeResponse(true));
      vi.stubGlobal("fetch", fetchMock);

      const tc = createTestContainer();
      const service = tc.container.resolve(PullPicsumImagesService);

      const result = await service.execute({ count: 2 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.downloaded).toBe(2);
        expect(result.value.files).toHaveLength(2);
        for (const fileName of result.value.files) {
          expect(fileName).toMatch(/^picsum-.+\.jpg$/);
        }
      }

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith("https://picsum.photos/800/600");
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      expect(fs.mkdirSync).toHaveBeenCalled();
    }, 10000);

    it("should use custom width and height", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeFakeResponse(true));
      vi.stubGlobal("fetch", fetchMock);

      const tc = createTestContainer();
      const service = tc.container.resolve(PullPicsumImagesService);

      await service.execute({ count: 1, width: 400, height: 300 });

      expect(fetchMock).toHaveBeenCalledWith("https://picsum.photos/400/300");
    });

    it("should skip failed downloads and continue with the rest", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeFakeResponse(false, 500))
        .mockResolvedValueOnce(makeFakeResponse(true));
      vi.stubGlobal("fetch", fetchMock);

      const tc = createTestContainer();
      const service = tc.container.resolve(PullPicsumImagesService);

      const result = await service.execute({ count: 2 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.downloaded).toBe(1);
        expect(result.value.files).toHaveLength(1);
      }
    }, 10000);

    it("should report progress after each downloaded image", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeFakeResponse(true));
      vi.stubGlobal("fetch", fetchMock);

      const tc = createTestContainer();
      const service = tc.container.resolve(PullPicsumImagesService);

      const onProgress = vi.fn();
      await service.execute({ count: 2, onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 50, expect.stringContaining("1/2"));
      expect(onProgress).toHaveBeenNthCalledWith(2, 100, expect.stringContaining("2/2"));
    }, 10000);

    it("should continue when fetch throws", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce(makeFakeResponse(true));
      vi.stubGlobal("fetch", fetchMock);

      const tc = createTestContainer();
      const service = tc.container.resolve(PullPicsumImagesService);

      const result = await service.execute({ count: 2 });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.downloaded).toBe(1);
      }
    }, 10000);
  });

  describe("ListLocalImagesService", () => {
    it("should return an empty array when the images directory does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const tc = createTestContainer();
      const service = tc.container.resolve(ListLocalImagesService);

      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toEqual([]);
      }
    });

    it("should list image files and filter out non-image files", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["photo.jpg", "picture.png", "notes.txt"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 5000 } as never);

      const tc = createTestContainer();
      const service = tc.container.resolve(ListLocalImagesService);

      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toHaveLength(2);
        const fileNames = result.value.files.map((f) => f.fileName).sort();
        expect(fileNames).toEqual(["photo.jpg", "picture.png"]);

        const jpg = result.value.files.find((f) => f.fileName === "photo.jpg");
        expect(jpg?.fileType).toBe("image/jpeg");
        expect(jpg?.fileSize).toBe(5000);
      }
    });
  });
});
