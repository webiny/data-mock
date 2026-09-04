import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { SyncFilesService } from "../abstractions/SyncFilesService.js";
import { SyncProjectFilesRepository } from "../abstractions/SyncProjectFilesRepository.js";
import { ListProjectFilesRepository } from "../../list/abstractions/ListProjectFilesRepository.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";

function createMockHttpClient(): HttpClient.Interface {
  return { post: vi.fn() };
}

function createMockResponse(status: number, body: unknown): HttpClient.Response {
  return {
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

interface IFmFile {
  id: string;
  name: string;
  key: string;
  src: string;
  type: string;
  size: number | null;
}

function createListFilesResponse(
  files: IFmFile[],
  meta: { cursor: string | null; hasMoreItems: boolean },
  error: { message: string; code: string } | null = null,
) {
  return createMockResponse(200, {
    data: {
      fileManager: {
        listFiles: {
          data: files,
          meta,
          error,
        },
      },
    },
  });
}

async function createProject(
  tc: ReturnType<typeof createTestContainer>,
  mockHttpClient?: HttpClient.Interface,
) {
  // Project creation triggers VerifyProjectAccessService + TenantSyncService, each issuing
  // an HTTP call. Give them a harmless response so creation succeeds, then reset the mock's
  // call history so tests can assert on calls made by the code under test only.
  if (mockHttpClient) {
    vi.mocked(mockHttpClient.post).mockResolvedValue(createMockResponse(200, {}));
  }

  const useCase = tc.container.resolve(CreateProjectUseCase);
  const result = await useCase.execute({
    name: "Test Project",
    apiUrl: "https://api.example.com/cms/manage",
    apiToken: "test-token",
    tenant: "root",
  });
  if (result.isFail()) {
    throw new Error(`Failed to create project: ${result.error.message}`);
  }

  if (mockHttpClient) {
    vi.mocked(mockHttpClient.post).mockClear();
  }

  return result.value;
}

describe("Sync Files", () => {
  describe("SyncFilesService", () => {
    it("should fetch and store files from a single page", async () => {
      const mockHttpClient = createMockHttpClient();
      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc, mockHttpClient);

        vi.mocked(mockHttpClient.post).mockResolvedValue(
          createListFilesResponse(
            [
              {
                id: "1",
                name: "a.jpg",
                key: "files/a.jpg",
                src: "https://cdn/a.jpg",
                type: "image/jpeg",
                size: 100,
              },
              {
                id: "2",
                name: "b.png",
                key: "files/b.png",
                src: "https://cdn/b.png",
                type: "image/png",
                size: 200,
              },
            ],
            { cursor: null, hasMoreItems: false },
          ),
        );

        const syncService = tc.container.resolve(SyncFilesService);
        const result = await syncService.execute({ projectId: project.id, tenant: "root" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.synced).toBe(2);
          expect(result.value.files).toHaveLength(2);
          expect(result.value.files.map((f) => f.fileKey)).toEqual(["files/a.jpg", "files/b.png"]);
        }

        expect(mockHttpClient.post).toHaveBeenCalledTimes(1);

        const listRepo = tc.container.resolve(ListProjectFilesRepository);
        const listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value.files).toHaveLength(2);
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should paginate through multiple pages of files", async () => {
      const mockHttpClient = createMockHttpClient();
      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc, mockHttpClient);

        vi.mocked(mockHttpClient.post)
          .mockResolvedValueOnce(
            createListFilesResponse(
              [
                {
                  id: "1",
                  name: "a.jpg",
                  key: "files/a.jpg",
                  src: "https://cdn/a.jpg",
                  type: "image/jpeg",
                  size: 100,
                },
              ],
              { cursor: "cursor-1", hasMoreItems: true },
            ),
          )
          .mockResolvedValueOnce(
            createListFilesResponse(
              [
                {
                  id: "2",
                  name: "b.png",
                  key: "files/b.png",
                  src: "https://cdn/b.png",
                  type: "image/png",
                  size: 200,
                },
              ],
              { cursor: null, hasMoreItems: false },
            ),
          );

        const syncService = tc.container.resolve(SyncFilesService);
        const result = await syncService.execute({ projectId: project.id, tenant: "root" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.synced).toBe(2);
        }

        expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
        const secondCallBody = JSON.parse(vi.mocked(mockHttpClient.post).mock.calls[1]![1]) as {
          variables: { after: string | null };
        };
        expect(secondCallBody.variables.after).toBe("cursor-1");
      } finally {
        tc.cleanup();
      }
    });

    it("should return error when GraphQL returns an error", async () => {
      const mockHttpClient = createMockHttpClient();
      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc, mockHttpClient);

        vi.mocked(mockHttpClient.post).mockResolvedValue(
          createListFilesResponse(
            [],
            { cursor: null, hasMoreItems: false },
            {
              message: "Access denied",
              code: "SECURITY_NOT_AUTHORIZED",
            },
          ),
        );

        const syncService = tc.container.resolve(SyncFilesService);
        const result = await syncService.execute({ projectId: project.id, tenant: "root" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("GraphQL/RequestError");
          expect(result.error.message).toBe("Access denied");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return error when HTTP status is not 200", async () => {
      const mockHttpClient = createMockHttpClient();
      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc, mockHttpClient);

        vi.mocked(mockHttpClient.post).mockResolvedValue(createMockResponse(500, "Server Error"));

        const syncService = tc.container.resolve(SyncFilesService);
        const result = await syncService.execute({ projectId: project.id, tenant: "root" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("GraphQL/RequestError");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return error for non-existent project", async () => {
      const tc = createTestContainer();

      try {
        const syncService = tc.container.resolve(SyncFilesService);
        const result = await syncService.execute({ projectId: "non-existent", tenant: "root" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("Project/NotFound");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("SyncProjectFilesRepository", () => {
    it("should replace existing files for the same tenant on re-sync", async () => {
      const tc = createTestContainer();

      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectFilesRepository);

        await syncRepo.execute({
          projectId: project.id,
          tenant: "root",
          files: [
            {
              fileKey: "a.jpg",
              fileUrl: "https://cdn/a.jpg",
              fileName: "a.jpg",
              fileType: "image/jpeg",
              fileSize: 100,
            },
            {
              fileKey: "b.jpg",
              fileUrl: "https://cdn/b.jpg",
              fileName: "b.jpg",
              fileType: "image/jpeg",
              fileSize: 200,
            },
          ],
        });

        const listRepo = tc.container.resolve(ListProjectFilesRepository);
        let listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value.files).toHaveLength(2);
        }

        await syncRepo.execute({
          projectId: project.id,
          tenant: "root",
          files: [
            {
              fileKey: "c.jpg",
              fileUrl: "https://cdn/c.jpg",
              fileName: "c.jpg",
              fileType: "image/jpeg",
              fileSize: 300,
            },
          ],
        });

        listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value.files).toHaveLength(1);
          expect(listResult.value.files[0]!.fileKey).toBe("c.jpg");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should not affect files stored for a different tenant", async () => {
      const tc = createTestContainer();

      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectFilesRepository);

        await syncRepo.execute({
          projectId: project.id,
          tenant: "root",
          files: [
            {
              fileKey: "root-a.jpg",
              fileUrl: "https://cdn/root-a.jpg",
              fileName: "root-a.jpg",
              fileType: "image/jpeg",
              fileSize: 100,
            },
          ],
        });

        await syncRepo.execute({
          projectId: project.id,
          tenant: "tenant-2",
          files: [
            {
              fileKey: "t2-a.jpg",
              fileUrl: "https://cdn/t2-a.jpg",
              fileName: "t2-a.jpg",
              fileType: "image/jpeg",
              fileSize: 100,
            },
          ],
        });

        const listRepo = tc.container.resolve(ListProjectFilesRepository);
        const listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value.files).toHaveLength(2);
          const tenants = listResult.value.files.map((f) => f.tenant).sort();
          expect(tenants).toEqual(["root", "tenant-2"]);
        }
      } finally {
        tc.cleanup();
      }
    });
  });
});
