import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UploadFileRepository } from "~/shared/node/features/files/upload/abstractions/UploadFileRepository.js";
import { UploadGlobalFilesToProjectService } from "../abstractions/UploadGlobalFilesToProjectService.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-bytes")),
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ isFile: () => true, size: 1000 }),
    unlinkSync: vi.fn(),
  };
});

describe("UploadGlobalFilesToProjectService", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();

    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "Pool Project",
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

  it("should report zero uploaded when there are no local images to link", async () => {
    const service = tc.container.resolve(UploadGlobalFilesToProjectService);

    const result = await service.execute({ projectId, tenant: "root" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.uploaded).toBe(0);
      expect(result.value.files).toEqual([]);
    }
  });

  it("should count only newly uploaded files, excluding files already linked to the project", async () => {
    const uploadRepo = tc.container.resolve(UploadFileRepository);
    await uploadRepo.execute({
      projectId,
      tenant: "root",
      fileKey: "images/existing.jpg",
      fileUrl: "https://cdn.example.com/images/existing.jpg",
      fileName: "existing.jpg",
      fileType: "image/jpeg",
      fileSize: 100,
    });

    const service = tc.container.resolve(UploadGlobalFilesToProjectService);
    const result = await service.execute({ projectId, tenant: "root" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.uploaded).toBe(0);
      expect(result.value.files).toHaveLength(1);
      expect(result.value.files[0]?.fileName).toBe("existing.jpg");
    }
  });
});
