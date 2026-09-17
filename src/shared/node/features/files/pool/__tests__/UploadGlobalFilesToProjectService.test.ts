import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { UploadFileRepository } from "~/shared/node/features/files/upload/abstractions/UploadFileRepository.js";
import { UploadGlobalFilesToProjectService } from "../abstractions/UploadGlobalFilesToProjectService.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";

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

const fs = await import("node:fs");

function createMockHttpClient(): HttpClient.Interface {
  return { post: vi.fn() };
}

function createMockResponse(status: number, body: unknown): HttpClient.Response {
  return {
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

const presignedFile = {
  id: "file-1",
  name: "upload.jpg",
  type: "image/jpeg",
  size: 1000,
  key: "files/upload.jpg",
};
const presignedPayload = {
  url: "https://s3.example.com/bucket",
  fields: { key: "files/upload.jpg", policy: "abc" },
};
const createdFile = {
  id: "file-1",
  key: "files/upload.jpg",
  src: "https://cdn.example.com/files/upload.jpg",
  name: "upload.jpg",
  type: "image/jpeg",
  size: 1000,
};

/**
 * Routes GraphQL calls to presigned-payload / create-file responses based on the query. Anything
 * else (tenant verification / sync during project creation) gets a generic success shape those
 * callers already tolerate failing to parse (they only warn-and-continue).
 */
function autoSucceed(): HttpClient.Interface["post"] {
  return vi.fn(async (_url: string, body: string) => {
    const parsed = JSON.parse(body) as { query: string };
    if (parsed.query.includes("getPreSignedPostPayload")) {
      return createMockResponse(200, {
        data: {
          fileManager: {
            getPreSignedPostPayload: {
              data: { data: presignedPayload, file: presignedFile },
              error: null,
            },
          },
        },
      });
    }
    if (parsed.query.includes("createFile")) {
      return createMockResponse(200, {
        data: { fileManager: { createFile: { data: createdFile, error: null } } },
      });
    }
    return createMockResponse(200, {});
  });
}

async function setupProject(tc: ReturnType<typeof createTestContainer>) {
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
  return result.value;
}

describe("UploadGlobalFilesToProjectService", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();

    const created = await setupProject(tc);
    projectId = created.project.id;
    environmentId = created.environment.id;
  });

  afterEach(() => {
    tc.cleanup();
    vi.unstubAllGlobals();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);
  });

  it("should report zero uploaded when there are no local images to link", async () => {
    const service = tc.container.resolve(UploadGlobalFilesToProjectService);

    const result = await service.execute({ environmentId, tenant: "root" });

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
      environmentId,
      tenant: "root",
      fileKey: "images/existing.jpg",
      fileUrl: "https://cdn.example.com/images/existing.jpg",
      fileName: "existing.jpg",
      fileType: "image/jpeg",
      fileSize: 100,
    });

    const service = tc.container.resolve(UploadGlobalFilesToProjectService);
    const result = await service.execute({ environmentId, tenant: "root" });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.uploaded).toBe(0);
      expect(result.value.files).toHaveLength(1);
      expect(result.value.files[0]?.fileName).toBe("existing.jpg");
    }
  });

  it("should route an empty fileNames array to the upload-all path", async () => {
    const service = tc.container.resolve(UploadGlobalFilesToProjectService);

    const result = await service.execute({ environmentId, tenant: "root", fileNames: [] });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.uploaded).toBe(0);
      expect(result.value.files).toEqual([]);
    }
  });

  describe("uploadAll", () => {
    it("should fail when listing existing project files fails", async () => {
      tc.databaseClient.db.run(sql`DROP TABLE project_files`);
      const service = tc.container.resolve(UploadGlobalFilesToProjectService);

      const result = await service.execute({ environmentId, tenant: "root" });

      expect(result.isFail()).toBe(true);
    });

    it("should fail when loading the file pool fails", async () => {
      vi.mocked(fs.existsSync).mockImplementationOnce(() => {
        throw new Error("disk unavailable");
      });
      const service = tc.container.resolve(UploadGlobalFilesToProjectService);

      const result = await service.execute({ environmentId, tenant: "root" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.message).toBe("disk unavailable");
      }
    });

    it("should count files newly added to the pool by the bulk upload", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["new.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());
      const fetchMock = vi.fn(async () => ({ status: 204, text: () => Promise.resolve("") }));
      vi.stubGlobal("fetch", fetchMock);

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);

      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(1);
        expect(result.value.failures).toEqual([]);
        expect(result.value.files).toHaveLength(1);
        expect(result.value.files[0]?.fileName).toBe("new.jpg");
      }
    });
  });

  describe("uploadSelected", () => {
    it("should fail when listing existing project files fails", async () => {
      tc.databaseClient.db.run(sql`DROP TABLE project_files`);
      const service = tc.container.resolve(UploadGlobalFilesToProjectService);

      const result = await service.execute({
        environmentId,
        tenant: "root",
        fileNames: ["a.jpg"],
      });

      expect(result.isFail()).toBe(true);
    });

    it("should fail when listing local images fails", async () => {
      vi.mocked(fs.existsSync).mockImplementationOnce(() => {
        throw new Error("disk unavailable");
      });
      const service = tc.container.resolve(UploadGlobalFilesToProjectService);

      const result = await service.execute({
        environmentId,
        tenant: "root",
        fileNames: ["a.jpg"],
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.message).toBe("disk unavailable");
      }
    });

    it("should report zero uploaded when none of the requested names match a local file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["unrelated.jpg"] as never);

      const service = tc.container.resolve(UploadGlobalFilesToProjectService);
      const result = await service.execute({
        environmentId,
        tenant: "root",
        fileNames: ["missing.jpg"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(0);
        expect(result.value.failures).toEqual([]);
        expect(result.value.files).toEqual([]);
      }
    });

    it("should upload only requested files that are not already linked, ignoring unrequested local files", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        "new.jpg",
        "existing.jpg",
        "unrequested.jpg",
      ] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());
      const fetchMock = vi.fn(async () => ({ status: 204, text: () => Promise.resolve("") }));
      vi.stubGlobal("fetch", fetchMock);

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      await httpTc.container.resolve(UploadFileRepository).execute({
        projectId: created.project.id,
        environmentId: created.environment.id,
        tenant: "root",
        fileKey: "images/existing.jpg",
        fileUrl: "https://cdn.example.com/images/existing.jpg",
        fileName: "existing.jpg",
        fileType: "image/jpeg",
        fileSize: 100,
      });
      vi.mocked(mockHttpClient.post).mockClear();

      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);
      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
        fileNames: ["new.jpg", "existing.jpg"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(1);
        expect(result.value.failures).toEqual([]);
        expect(result.value.files.map((f) => f.fileName).sort()).toEqual([
          "existing.jpg",
          "new.jpg",
        ]);
      }
      // "unrequested.jpg" must never have been sent for upload.
      const calls = vi.mocked(mockHttpClient.post).mock.calls;
      expect(calls.every(([, body]) => !String(body).includes("unrequested"))).toBe(true);
    });

    it("should report upload progress while uploading requested files", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["new.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());
      const fetchMock = vi.fn(async () => ({ status: 204, text: () => Promise.resolve("") }));
      vi.stubGlobal("fetch", fetchMock);

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      vi.mocked(mockHttpClient.post).mockClear();

      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);
      const onProgress = vi.fn();
      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
        fileNames: ["new.jpg"],
        onProgress,
      });

      expect(result.isOk()).toBe(true);
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenCalledWith(100, "Uploading: 1/1 files");
    });

    it("should record a failure and skip the file when the upload service returns an error", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["broken.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ status: 204, text: () => Promise.resolve("") })),
      );

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      vi.mocked(mockHttpClient.post).mockClear();
      vi.mocked(mockHttpClient.post).mockImplementation(async (_url, body: string) => {
        const parsed = JSON.parse(body) as { query: string };
        if (parsed.query.includes("getPreSignedPostPayload")) {
          return createMockResponse(200, {
            data: {
              fileManager: {
                getPreSignedPostPayload: {
                  data: null,
                  error: { message: "Access denied", code: "SECURITY_NOT_AUTHORIZED" },
                },
              },
            },
          });
        }
        return createMockResponse(200, {
          data: { fileManager: { createFile: { data: createdFile, error: null } } },
        });
      });

      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);
      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
        fileNames: ["broken.jpg"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(0);
        expect(result.value.failures).toEqual([{ fileName: "broken.jpg", error: "Access denied" }]);
        expect(result.value.files).toEqual([]);
      }
    });

    it("should record a failure when the upload service throws an Error", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["throws.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      vi.mocked(mockHttpClient.post).mockClear();
      vi.mocked(mockHttpClient.post).mockRejectedValue(new Error("network down"));

      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);
      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
        fileNames: ["throws.jpg"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(0);
        expect(result.value.failures).toEqual([{ fileName: "throws.jpg", error: "network down" }]);
      }
    });

    it("should record a failure when the upload service throws a non-Error value", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["throws-raw.jpg"] as never);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 1000 } as never);

      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());

      const httpTc = createTestContainer({ httpClient: mockHttpClient });
      const created = await setupProject(httpTc);
      vi.mocked(mockHttpClient.post).mockClear();
      vi.mocked(mockHttpClient.post).mockImplementation(() => {
        throw "boom";
      });

      const service = httpTc.container.resolve(UploadGlobalFilesToProjectService);
      const result = await service.execute({
        environmentId: created.environment.id,
        tenant: "root",
        fileNames: ["throws-raw.jpg"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.uploaded).toBe(0);
        expect(result.value.failures).toEqual([{ fileName: "throws-raw.jpg", error: "boom" }]);
      }
    });
  });
});
