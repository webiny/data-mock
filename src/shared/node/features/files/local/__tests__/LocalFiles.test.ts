import { describe, it, expect, afterEach, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UploadFileRepository } from "~/shared/node/features/files/upload/abstractions/UploadFileRepository.js";
import { ListLocalFilesService } from "../abstractions/ListLocalFilesService.js";
import { SaveLocalFileService } from "../abstractions/SaveLocalFileService.js";
import { DeleteLocalFileService } from "../abstractions/DeleteLocalFileService.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isFile: () => true, size: 1000 }),
    unlinkSync: vi.fn(),
  };
});

const fs = await import("node:fs");

describe("Local Files Feature", () => {
  let tc: ReturnType<typeof createTestContainer>;

  afterEach(() => {
    if (tc) {
      tc.cleanup();
    }
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
  });

  describe("ListLocalFilesService", () => {
    it("should return an empty array when no local files exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      tc = createTestContainer();
      const service = tc.container.resolve(ListLocalFilesService);
      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toEqual([]);
      }
    });

    it("should list local files with an empty project status when not uploaded anywhere", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["photo.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 9 } as never);

      tc = createTestContainer();
      const service = tc.container.resolve(ListLocalFilesService);
      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toHaveLength(1);
        expect(result.value.files[0]?.fileName).toBe("photo.jpg");
        expect(result.value.files[0]?.uploadedToProjects).toEqual([]);
      }
    });

    it("should include project upload status for files uploaded to projects", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["photo.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 9 } as never);

      tc = createTestContainer();
      const createProject = tc.container.resolve(CreateProjectUseCase);
      const projectResult = await createProject.execute({
        name: "My Project",
        apiUrl: "https://api.example.com",
        apiToken: "token",
        tenant: "root",
      });
      expect(projectResult.isOk()).toBe(true);
      if (!projectResult.isOk()) {
        return;
      }
      const projectId = projectResult.value.id;

      const uploadRepo = tc.container.resolve(UploadFileRepository);
      await uploadRepo.execute({
        projectId,
        tenant: "root",
        fileKey: "images/photo.jpg",
        fileUrl: "https://cdn.example.com/images/photo.jpg",
        fileName: "photo.jpg",
        fileType: "image/jpeg",
        fileSize: 9,
      });

      const service = tc.container.resolve(ListLocalFilesService);
      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toHaveLength(1);
        expect(result.value.files[0]?.uploadedToProjects).toEqual([
          { projectId, projectName: "My Project" },
        ]);
      }
    });
  });

  describe("SaveLocalFileService", () => {
    it("should call writeFileSync with decoded content", async () => {
      tc = createTestContainer();
      const service = tc.container.resolve(SaveLocalFileService);
      const content = Buffer.from("hello-world").toString("base64");

      const result = await service.execute({ fileName: "hello.txt", fileContent: content });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fileName).toBe("hello.txt");
        expect(result.value.fileSize).toBe(Buffer.byteLength("hello-world"));
      }
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("should guess the content type from the file extension", async () => {
      tc = createTestContainer();
      const service = tc.container.resolve(SaveLocalFileService);
      const content = Buffer.from("png-bytes").toString("base64");

      const result = await service.execute({ fileName: "picture.png", fileContent: content });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fileType).toBe("image/png");
      }
    });

    it("should reject file names containing path traversal sequences", async () => {
      tc = createTestContainer();
      const service = tc.container.resolve(SaveLocalFileService);

      const result = await service.execute({
        fileName: "../../etc/passwd",
        fileContent: Buffer.from("x").toString("base64"),
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Validation/Error");
      }
    });

    it("should reject file names containing path separators", async () => {
      tc = createTestContainer();
      const service = tc.container.resolve(SaveLocalFileService);

      const result = await service.execute({
        fileName: "sub/dir/file.txt",
        fileContent: Buffer.from("x").toString("base64"),
      });

      expect(result.isFail()).toBe(true);
    });
  });

  describe("DeleteLocalFileService", () => {
    it("should call unlinkSync for an existing file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      tc = createTestContainer();
      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "delete-me.jpg" });

      expect(result.isOk()).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it("should succeed when the file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      tc = createTestContainer();
      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "does-not-exist.jpg" });

      expect(result.isOk()).toBe(true);
    });

    it("should reject unsafe file names", async () => {
      tc = createTestContainer();
      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "../secret.txt" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Validation/Error");
      }
    });
  });
});
