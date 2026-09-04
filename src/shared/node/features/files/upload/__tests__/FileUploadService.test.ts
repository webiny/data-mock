import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { FileUploadService } from "../abstractions/FileUploadService.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";

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
  name: "test.txt",
  type: "text/plain",
  size: 11,
  key: "files/test.txt",
};
const presignedPayload = {
  url: "https://s3.example.com/bucket",
  fields: { key: "files/test.txt", policy: "abc" },
};
const createdFile = {
  id: "file-1",
  key: "files/test.txt",
  src: "https://cdn.example.com/files/test.txt",
  name: "test.txt",
  type: "text/plain",
  size: 11,
};

/** Routes GraphQL calls to presigned-payload / create-file responses based on the query. */
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
    return createMockResponse(200, {
      data: { fileManager: { createFile: { data: createdFile, error: null } } },
    });
  });
}

describe("FileUploadService", () => {
  let tmpDir: string;
  let filePath: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "file-upload-test-"));
    filePath = join(tmpDir, "test.txt");
    writeFileSync(filePath, "hello world");

    fetchMock = vi.fn(async () => ({ status: 204, text: () => Promise.resolve("") }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function setupProject(tc: ReturnType<typeof createTestContainer>) {
    const createUseCase = tc.container.resolve(CreateProjectUseCase);
    const result = await createUseCase.execute({
      name: "File Upload Project",
      apiUrl: "https://api.example.com/cms/manage",
      apiToken: "upload-token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error(`Failed to create project: ${result.error.message}`);
    }
    return result.value;
  }

  it("should run the 3-step upload flow and store the file locally", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    const project = await setupProject(tc);
    vi.mocked(mockHttpClient.post).mockClear();
    const service = tc.container.resolve(FileUploadService);

    const result = await service.execute({
      projectId: project.id,
      tenant: "root",
      filePath,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.file.fileKey).toBe("files/test.txt");
      expect(result.value.file.fileUrl).toBe("https://cdn.example.com/files/test.txt");
      expect(result.value.file.fileName).toBe("test.txt");
      expect(result.value.file.fileType).toBe("text/plain");
    }

    // Presigned payload query + create file mutation via GraphQL.
    expect(mockHttpClient.post).toHaveBeenCalledTimes(2);

    // Raw upload to the presigned S3 URL.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadUrl).toBe(presignedPayload.url);
    expect(uploadInit.method).toBe("POST");
    expect(uploadInit.body).toBeInstanceOf(FormData);
  });

  it("should fail when the presigned payload request returns an error", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(async (_url, body) => {
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

    const tc = createTestContainer({ httpClient: mockHttpClient });
    const project = await setupProject(tc);
    const service = tc.container.resolve(FileUploadService);

    const result = await service.execute({ projectId: project.id, tenant: "root", filePath });

    expect(result.isFail()).toBe(true);
    if (result.isFail()) {
      expect(result.error.message).toBe("Access denied");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should fail when the S3 upload does not return 204", async () => {
    fetchMock.mockImplementation(async () => ({
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    }));

    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceed());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    const project = await setupProject(tc);
    vi.mocked(mockHttpClient.post).mockClear();
    const service = tc.container.resolve(FileUploadService);

    const result = await service.execute({ projectId: project.id, tenant: "root", filePath });

    expect(result.isFail()).toBe(true);
    if (result.isFail()) {
      expect(result.error.message).toContain("S3 upload failed");
    }
    // createFile mutation must never run if the S3 upload failed.
    expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
  });

  it("should fail when the create file mutation returns an error", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(async (_url, body) => {
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
      return createMockResponse(200, {
        data: {
          fileManager: {
            createFile: { data: null, error: { message: "Invalid data", code: "VALIDATION" } },
          },
        },
      });
    });

    const tc = createTestContainer({ httpClient: mockHttpClient });
    const project = await setupProject(tc);
    const service = tc.container.resolve(FileUploadService);

    const result = await service.execute({ projectId: project.id, tenant: "root", filePath });

    expect(result.isFail()).toBe(true);
    if (result.isFail()) {
      expect(result.error.message).toBe("Invalid data");
    }
  });
});
