import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { TenantSyncService } from "../sync/abstractions/TenantSyncService.js";
import { ListProjectTenantsRepository } from "../list/abstractions/ListProjectTenantsRepository.js";
import { SyncProjectTenantsRepository } from "../sync/abstractions/SyncProjectTenantsRepository.js";
import { VerifyProjectAccessService } from "../verify/abstractions/VerifyProjectAccessService.js";
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

function createTenantListResponse(tenants: Array<{ id: string; name: string }>) {
  return createMockResponse(200, {
    data: {
      listTenants: {
        data: tenants.map((t) => ({ id: t.id, values: { name: t.name } })),
      },
    },
  });
}

async function createProject(tc: ReturnType<typeof createTestContainer>) {
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
  return result.value;
}

describe("Tenant Sync", () => {
  describe("TenantSyncService", () => {
    it("should fetch and store tenants from Webiny API", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockResolvedValue(
        createTenantListResponse([
          { id: "root", name: "Root" },
          { id: "tenant-1", name: "Tenant One" },
          { id: "tenant-2", name: "Tenant Two" },
        ]),
      );

      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc);

        const syncService = tc.container.resolve(TenantSyncService);
        const result = await syncService.execute({ projectId: project.id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.synced).toBe(3);
          expect(result.value.tenants).toHaveLength(3);
          expect(result.value.tenants.map((t) => t.tenantId)).toEqual([
            "root",
            "tenant-1",
            "tenant-2",
          ]);
        }

        const listRepo = tc.container.resolve(ListProjectTenantsRepository);
        const listResult = await listRepo.execute({ projectId: project.id });

        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value).toHaveLength(3);
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should store only default tenant when API fails", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockRejectedValue(new Error("Network error"));

      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc);

        const syncService = tc.container.resolve(TenantSyncService);
        const result = await syncService.execute({ projectId: project.id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.synced).toBe(1);
          expect(result.value.tenants).toHaveLength(1);
          expect(result.value.tenants[0]!.tenantId).toBe("root");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return error for non-existent project", async () => {
      const tc = createTestContainer();

      try {
        const syncService = tc.container.resolve(TenantSyncService);
        const result = await syncService.execute({ projectId: "non-existent" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("Project/NotFound");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("SyncProjectTenantsRepository", () => {
    it("should replace existing tenants on re-sync", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockResolvedValue(
        createTenantListResponse([{ id: "root", name: "Root" }]),
      );

      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc);

        const syncRepo = tc.container.resolve(SyncProjectTenantsRepository);

        await syncRepo.execute({
          projectId: project.id,
          tenants: [
            { tenantId: "root", name: "Root" },
            { tenantId: "old-tenant", name: "Old" },
          ],
        });

        const listRepo = tc.container.resolve(ListProjectTenantsRepository);
        let listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value).toHaveLength(2);
        }

        await syncRepo.execute({
          projectId: project.id,
          tenants: [
            { tenantId: "root", name: "Root" },
            { tenantId: "new-tenant", name: "New" },
            { tenantId: "another-tenant", name: "Another" },
          ],
        });

        listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value).toHaveLength(3);
          const ids = listResult.value.map((t) => t.tenantId);
          expect(ids).toContain("root");
          expect(ids).toContain("new-tenant");
          expect(ids).toContain("another-tenant");
          expect(ids).not.toContain("old-tenant");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("ListProjectTenantsRepository", () => {
    it("should return empty array when no tenants stored", async () => {
      const tc = createTestContainer();

      try {
        const listRepo = tc.container.resolve(ListProjectTenantsRepository);
        const result = await listRepo.execute({ projectId: "any-id" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual([]);
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("VerifyProjectAccessService", () => {
    it("should return ok when API responds with 200", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockResolvedValue(
        createMockResponse(200, { data: { cms: { listContentModelGroups: { data: [] } } } }),
      );

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const service = tc.container.resolve(VerifyProjectAccessService);
        const result = await service.execute({
          apiUrl: "https://api.example.com/cms/manage",
          apiToken: "test-token",
          tenant: "root",
        });
        expect(result.isOk()).toBe(true);
      } finally {
        tc.cleanup();
      }
    });

    it("should return error when API responds with non-200", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockResolvedValue(createMockResponse(401, "Unauthorized"));

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const service = tc.container.resolve(VerifyProjectAccessService);
        const result = await service.execute({
          apiUrl: "https://api.example.com/cms/manage",
          apiToken: "bad-token",
          tenant: "root",
        });
        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("GraphQL/RequestError");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return error when network fails", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockRejectedValue(new Error("Connection refused"));

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const service = tc.container.resolve(VerifyProjectAccessService);
        const result = await service.execute({
          apiUrl: "https://api.example.com/cms/manage",
          apiToken: "test-token",
          tenant: "root",
        });
        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.message).toContain("Connection refused");
        }
      } finally {
        tc.cleanup();
      }
    });
  });
});
