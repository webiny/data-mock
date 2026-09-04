import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { PullPicsumImagesService } from "../abstractions/PullPicsumImagesService.js";
import { ListLocalImagesService } from "../abstractions/ListLocalImagesService.js";

const IMAGES_DIR = join(process.cwd(), ".webiny", "images");

function makeFakeResponse(ok: boolean, status: number = 200): Response {
  return {
    ok,
    status,
    arrayBuffer: async () => new TextEncoder().encode("fake-image-bytes").buffer,
  } as Response;
}

describe("Picsum Feature", () => {
  beforeEach(() => {
    rmSync(IMAGES_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(IMAGES_DIR, { recursive: true, force: true });
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
        expect(result.value.directory).toBe(IMAGES_DIR);
        expect(result.value.files).toHaveLength(2);
        for (const fileName of result.value.files) {
          expect(fileName).toMatch(/^picsum-.+\.jpg$/);
          expect(existsSync(join(IMAGES_DIR, fileName))).toBe(true);
        }
      }

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith("https://picsum.photos/800/600");
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
      const tc = createTestContainer();
      const service = tc.container.resolve(ListLocalImagesService);

      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toEqual([]);
      }
    });

    it("should list image files and filter out non-image files", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "photo.jpg"), "jpg-bytes");
      writeFileSync(join(IMAGES_DIR, "picture.png"), "png-bytes");
      writeFileSync(join(IMAGES_DIR, "notes.txt"), "not-an-image");

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
        expect(jpg?.filePath).toBe(join(IMAGES_DIR, "photo.jpg"));
        expect(jpg?.fileSize).toBeGreaterThan(0);
      }
    });
  });
});
