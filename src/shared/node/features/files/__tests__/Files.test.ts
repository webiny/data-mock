import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UploadFileRepository } from "../upload/abstractions/UploadFileRepository.js";
import { ListProjectFilesRepository } from "../list/abstractions/ListProjectFilesRepository.js";
import { DeleteProjectFileRepository } from "../delete/abstractions/DeleteProjectFileRepository.js";

describe("Files Feature", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "Files Project",
      apiUrl: "https://api.example.com",
      apiToken: "token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error("Failed to create project");
    }
    projectId = result.value.id;
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("UploadFileRepository", () => {
    it("should create a file record", async () => {
      const repo = tc.container.resolve(UploadFileRepository);
      const result = await repo.execute({
        projectId,
        tenant: "root",
        fileKey: "images/photo.jpg",
        fileUrl: "https://cdn.example.com/images/photo.jpg",
        fileName: "photo.jpg",
        fileType: "image/jpeg",
        fileSize: 1024,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBeDefined();
        expect(result.value.projectId).toBe(projectId);
        expect(result.value.tenant).toBe("root");
        expect(result.value.fileKey).toBe("images/photo.jpg");
        expect(result.value.fileName).toBe("photo.jpg");
        expect(result.value.fileType).toBe("image/jpeg");
        expect(result.value.fileSize).toBe(1024);
      }
    });

    it("should accept null file size", async () => {
      const repo = tc.container.resolve(UploadFileRepository);
      const result = await repo.execute({
        projectId,
        tenant: "root",
        fileKey: "docs/readme.md",
        fileUrl: "https://cdn.example.com/docs/readme.md",
        fileName: "readme.md",
        fileType: "text/markdown",
        fileSize: null,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.fileSize).toBeNull();
      }
    });
  });

  describe("ListProjectFilesRepository", () => {
    it("should return empty array when no files exist", async () => {
      const repo = tc.container.resolve(ListProjectFilesRepository);
      const result = await repo.execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toEqual([]);
      }
    });

    it("should list all files for a project", async () => {
      const uploadRepo = tc.container.resolve(UploadFileRepository);
      const listRepo = tc.container.resolve(ListProjectFilesRepository);

      await uploadRepo.execute({
        projectId,
        tenant: "root",
        fileKey: "a.jpg",
        fileUrl: "https://cdn.example.com/a.jpg",
        fileName: "a.jpg",
        fileType: "image/jpeg",
        fileSize: 100,
      });
      await uploadRepo.execute({
        projectId,
        tenant: "root",
        fileKey: "b.png",
        fileUrl: "https://cdn.example.com/b.png",
        fileName: "b.png",
        fileType: "image/png",
        fileSize: 200,
      });

      const result = await listRepo.execute({ projectId });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.files).toHaveLength(2);
      }
    });
  });

  describe("DeleteProjectFileRepository", () => {
    it("should delete a file record", async () => {
      const uploadRepo = tc.container.resolve(UploadFileRepository);
      const deleteRepo = tc.container.resolve(DeleteProjectFileRepository);
      const listRepo = tc.container.resolve(ListProjectFilesRepository);

      const uploadResult = await uploadRepo.execute({
        projectId,
        tenant: "root",
        fileKey: "delete-me.jpg",
        fileUrl: "https://cdn.example.com/delete-me.jpg",
        fileName: "delete-me.jpg",
        fileType: "image/jpeg",
        fileSize: 50,
      });
      expect(uploadResult.isOk()).toBe(true);
      if (!uploadResult.isOk()) {
        return;
      }

      const deleteResult = await deleteRepo.execute({ id: uploadResult.value.id });
      expect(deleteResult.isOk()).toBe(true);

      const listResult = await listRepo.execute({ projectId });
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        expect(listResult.value.files).toHaveLength(0);
      }
    });
  });
});
