import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { SyncProjectModelsRepository } from "~/shared/node/features/models/sync/abstractions/SyncProjectModelsRepository.js";
import { CreateSeedJobRepository } from "../create/abstractions/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "../update/abstractions/UpdateSeedJobRepository.js";
import { ListSeedJobsRepository } from "../list/abstractions/ListSeedJobsRepository.js";
import { SeedService } from "../seed/abstractions/SeedService.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { ApiCmsModelField } from "~/shared/types.js";

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

const textField: ApiCmsModelField = {
  id: "f1",
  fieldId: "title",
  storageId: "title",
  type: "text",
  list: false,
  settings: {},
  predefinedValues: { enabled: false, values: [] },
  validation: [],
  listValidation: [],
};

const numberField: ApiCmsModelField = {
  id: "f2",
  fieldId: "count",
  storageId: "count",
  type: "number",
  list: false,
  settings: {},
  predefinedValues: { enabled: false, values: [] },
  validation: [],
  listValidation: [],
};

async function setupProject(tc: ReturnType<typeof createTestContainer>) {
  const createUseCase = tc.container.resolve(CreateProjectUseCase);
  const result = await createUseCase.execute({
    name: "Seed Project",
    apiUrl: "https://api.example.com/cms/manage",
    apiToken: "seed-token",
    tenant: "root",
  });
  if (result.isFail()) {
    throw new Error(`Failed to create project: ${result.error.message}`);
  }

  const syncModels = tc.container.resolve(SyncProjectModelsRepository);
  await syncModels.execute({
    projectId: result.value.id,
    models: [
      {
        groupSlug: "blog",
        modelId: "article",
        name: "Article",
        fields: [textField, numberField],
        remoteId: "m1",
      },
    ],
  });

  return result.value;
}

describe("Seeding Feature", () => {
  describe("CreateSeedJobRepository", () => {
    it("should create a seed job", async () => {
      const tc = createTestContainer();
      try {
        const project = await setupProject(tc);
        const repo = tc.container.resolve(CreateSeedJobRepository);
        const result = await repo.execute({
          projectId: project.id,
          config: { models: [{ modelId: "article", amount: 5 }] },
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.projectId).toBe(project.id);
          expect(["pending", "running"]).toContain(result.value.status);
          expect(result.value.config.models).toHaveLength(1);
          expect(result.value.id).toBeDefined();
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("UpdateSeedJobRepository", () => {
    it("should update seed job status and result", async () => {
      const tc = createTestContainer();
      try {
        const project = await setupProject(tc);
        const createRepo = tc.container.resolve(CreateSeedJobRepository);
        const updateRepo = tc.container.resolve(UpdateSeedJobRepository);
        const listRepo = tc.container.resolve(ListSeedJobsRepository);

        const createResult = await createRepo.execute({
          projectId: project.id,
          config: { models: [{ modelId: "article", amount: 5 }] },
        });

        expect(createResult.isOk()).toBe(true);
        if (!createResult.isOk()) {
          return;
        }

        const updateResult = await updateRepo.execute({
          id: createResult.value.id,
          status: "completed",
          result: { created: 5, errors: [] },
        });

        expect(updateResult.isOk()).toBe(true);

        const listResult = await listRepo.execute({ projectId: project.id });
        expect(listResult.isOk()).toBe(true);
        if (listResult.isOk()) {
          expect(listResult.value).toHaveLength(1);
          expect(listResult.value[0]!.status).toBe("completed");
          expect(listResult.value[0]!.result).toEqual({ created: 5, errors: [] });
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("ListSeedJobsRepository", () => {
    it("should list seed jobs ordered by date desc", async () => {
      const tc = createTestContainer();
      try {
        const project = await setupProject(tc);
        const createRepo = tc.container.resolve(CreateSeedJobRepository);
        const listRepo = tc.container.resolve(ListSeedJobsRepository);

        await createRepo.execute({
          projectId: project.id,
          config: { models: [{ modelId: "article", amount: 3 }] },
        });

        await createRepo.execute({
          projectId: project.id,
          config: { models: [{ modelId: "article", amount: 10 }] },
        });

        const result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(2);
          expect(result.value[0]!.createdAt).toBeGreaterThanOrEqual(result.value[1]!.createdAt);
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return empty array when no seed jobs exist", async () => {
      const tc = createTestContainer();
      try {
        const listRepo = tc.container.resolve(ListSeedJobsRepository);
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

  describe("SeedService", () => {
    it("should generate entries and send them to Webiny", async () => {
      const mockHttpClient = createMockHttpClient();
      const successResponse = createMockResponse(200, {
        data: {
          createArticle: {
            data: { id: "entry-1", entryId: "entry-1", title: "Test", count: 42 },
            error: null,
          },
        },
      });
      vi.mocked(mockHttpClient.post).mockResolvedValue(successResponse);

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const project = await setupProject(tc);

        const seedService = tc.container.resolve(SeedService);
        const result = await seedService.execute({
          projectId: project.id,
          tenant: "root",
          models: [{ modelId: "article", amount: 2 }],
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.jobId).toBeDefined();
          expect(result.value.created).toBe(2);
          expect(result.value.errors).toHaveLength(0);
        }

        expect(mockHttpClient.post).toHaveBeenCalled();
        const calls = vi.mocked(mockHttpClient.post).mock.calls;
        const seedCalls = calls.filter((c) => {
          const body = JSON.parse(c[1] as string) as { query?: string };
          return body.query?.includes("createArticle");
        });
        expect(seedCalls).toHaveLength(2);
      } finally {
        tc.cleanup();
      }
    });

    it("should return error for non-existent project", async () => {
      const tc = createTestContainer();
      try {
        const seedService = tc.container.resolve(SeedService);
        const result = await seedService.execute({
          projectId: "non-existent",
          tenant: "root",
          models: [{ modelId: "article", amount: 1 }],
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
          expect(result.error.code).toBe("Project/NotFound");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should handle HTTP errors gracefully", async () => {
      const mockHttpClient = createMockHttpClient();
      vi.mocked(mockHttpClient.post).mockResolvedValue(
        createMockResponse(500, "Internal Server Error"),
      );

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const project = await setupProject(tc);

        const seedService = tc.container.resolve(SeedService);
        const result = await seedService.execute({
          projectId: project.id,
          tenant: "root",
          models: [{ modelId: "article", amount: 1 }],
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.errors).toHaveLength(1);
          expect(result.value.created).toBe(0);
        }
      } finally {
        tc.cleanup();
      }
    });
  });
});
