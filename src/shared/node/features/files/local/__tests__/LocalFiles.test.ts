import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UploadFileRepository } from "~/shared/node/features/files/upload/abstractions/UploadFileRepository.js";
import { ListLocalFilesService } from "../abstractions/ListLocalFilesService.js";
import { SaveLocalFileService } from "../abstractions/SaveLocalFileService.js";
import { DeleteLocalFileService } from "../abstractions/DeleteLocalFileService.js";

const IMAGES_DIR = join(process.cwd(), ".webiny", "images");

describe("Local Files Feature", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
    rmSync(IMAGES_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    tc.cleanup();
    rmSync(IMAGES_DIR, { recursive: true, force: true });
  });

  describe("ListLocalFilesService", () => {
    it("should return an empty array when no local files exist", async () => {
      const service = tc.container.resolve(ListLocalFilesService);
      const result = await service.execute({});

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toEqual([]);
      }
    });

    it("should list local files with an empty project status when not uploaded anywhere", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "photo.jpg"), "jpg-bytes");

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
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "photo.jpg"), "jpg-bytes");

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
    it("should write the decoded file to the images directory", async () => {
      const service = tc.container.resolve(SaveLocalFileService);
      const content = Buffer.from("hello-world").toString("base64");

      const result = await service.execute({ fileName: "hello.txt", fileContent: content });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fileName).toBe("hello.txt");
        expect(result.value.fileSize).toBe(Buffer.byteLength("hello-world"));
      }
      expect(existsSync(join(IMAGES_DIR, "hello.txt"))).toBe(true);
    });

    it("should guess the content type from the file extension", async () => {
      const service = tc.container.resolve(SaveLocalFileService);
      const content = Buffer.from("png-bytes").toString("base64");

      const result = await service.execute({ fileName: "picture.png", fileContent: content });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fileType).toBe("image/png");
      }
    });

    it("should reject file names containing path traversal sequences", async () => {
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
      const service = tc.container.resolve(SaveLocalFileService);

      const result = await service.execute({
        fileName: "sub/dir/file.txt",
        fileContent: Buffer.from("x").toString("base64"),
      });

      expect(result.isFail()).toBe(true);
    });
  });

  describe("DeleteLocalFileService", () => {
    it("should delete an existing file from disk", async () => {
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, "delete-me.jpg"), "bytes");

      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "delete-me.jpg" });

      expect(result.isOk()).toBe(true);
      expect(existsSync(join(IMAGES_DIR, "delete-me.jpg"))).toBe(false);
    });

    it("should succeed when the file does not exist", async () => {
      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "does-not-exist.jpg" });

      expect(result.isOk()).toBe(true);
    });

    it("should reject unsafe file names", async () => {
      const service = tc.container.resolve(DeleteLocalFileService);
      const result = await service.execute({ fileName: "../secret.txt" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Validation/Error");
      }
    });
  });
});
