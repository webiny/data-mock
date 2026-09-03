import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { SyncProjectModelsRepository } from "~/shared/node/features/models/sync/abstractions/SyncProjectModelsRepository.js";
import { CreateSeedJobRepository } from "~/shared/node/features/seeding/create/abstractions/CreateSeedJobRepository.js";
import { CreateSeedEntryRepository } from "~/shared/node/features/seeding/entries/abstractions/CreateSeedEntryRepository.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { CleanupService } from "../abstractions/CleanupService.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { ApiCmsModelField } from "~/shared/types.js";

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

function makeField(
  fieldId: string,
  type: string,
  settings?: Record<string, unknown>,
): ApiCmsModelField {
  return {
    id: fieldId,
    fieldId,
    storageId: fieldId,
    type,
    list: false,
    settings: settings ?? {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
  };
}

/** Resolves each delete mutation to a successful response based on the model name in the query. */
function autoSucceedDelete(): HttpClient.Interface["post"] {
  return vi.fn(async (_url: string, body: string) => {
    const parsed = JSON.parse(body) as { query: string };
    const match = parsed.query.match(/delete(\w+)\(/);
    const name = match ? match[1] : "Unknown";
    return createMockResponse(200, { data: { [`delete${name}`]: { data: true, error: null } } });
  });
}

async function setupProject(tc: ReturnType<typeof createTestContainer>, name = "Cleanup Project") {
  const createUseCase = tc.container.resolve(CreateProjectUseCase);
  const result = await createUseCase.execute({
    name,
    apiUrl: "https://api.example.com/cms/manage",
    apiToken: "cleanup-token",
    tenant: "root",
  });
  if (result.isFail()) {
    throw new Error(`Failed to create project: ${result.error.message}`);
  }
  return result.value;
}

async function seedCreatedEntry(
  tc: ReturnType<typeof createTestContainer>,
  input: { projectId: string; modelId: string; entryId: string; jobId?: string | null },
) {
  const repo = tc.container.resolve(CreateSeedEntryRepository);
  const result = await repo.execute({
    jobId: input.jobId ?? null,
    projectId: input.projectId,
    tenant: "root",
    modelId: input.modelId,
    entryId: input.entryId,
    entryData: { title: "x" },
    responseData: null,
    httpStatus: 200,
    status: "created",
    error: null,
  });
  if (result.isFail()) {
    throw new Error("Failed to seed entry");
  }
  return result.value;
}

describe("CleanupService", () => {
  it("should delete created entries and mark them as deleted", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceedDelete());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const syncModels = tc.container.resolve(SyncProjectModelsRepository);
      await syncModels.execute({
        projectId: project.id,
        models: [
          {
            groupSlug: "blog",
            modelId: "article",
            name: "Article",
            singularApiName: "Article",
            pluralApiName: "Articles",
            fields: [makeField("title", "text")],
            remoteId: "m1",
          },
        ],
      });

      const entry1 = await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-1#0001",
      });
      const entry2 = await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-2#0001",
      });

      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.deleted).toBe(2);
        expect(result.value.errors).toBe(0);
        expect(result.value.models).toEqual([{ modelId: "article", deleted: 2, errors: 0 }]);
      }

      const listRepo = tc.container.resolve(ListSeedEntriesRepository);
      const listResult = await listRepo.execute({ projectId: project.id, status: "deleted" });
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        const ids = listResult.value.entries.map((e) => e.id).sort();
        expect(ids).toEqual([entry1.id, entry2.id].sort());
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should only delete entries for the given jobId when provided", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceedDelete());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const syncModels = tc.container.resolve(SyncProjectModelsRepository);
      await syncModels.execute({
        projectId: project.id,
        models: [
          {
            groupSlug: "blog",
            modelId: "article",
            name: "Article",
            singularApiName: "Article",
            pluralApiName: "Articles",
            fields: [makeField("title", "text")],
            remoteId: "m1",
          },
        ],
      });

      const createSeedJobRepository = tc.container.resolve(CreateSeedJobRepository);
      const job1Result = await createSeedJobRepository.execute({
        projectId: project.id,
        config: { models: [{ modelId: "article", amount: 1 }] },
      });
      const job2Result = await createSeedJobRepository.execute({
        projectId: project.id,
        config: { models: [{ modelId: "article", amount: 1 }] },
      });
      if (job1Result.isFail() || job2Result.isFail()) {
        throw new Error("Failed to create seed jobs");
      }

      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-job-1#0001",
        jobId: job1Result.value.id,
      });
      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-job-2#0001",
        jobId: job2Result.value.id,
      });

      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id, jobId: job1Result.value.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.deleted).toBe(1);
      }

      const listRepo = tc.container.resolve(ListSeedEntriesRepository);
      const remaining = await listRepo.execute({ projectId: project.id, status: "created" });
      expect(remaining.isOk()).toBe(true);
      if (remaining.isOk()) {
        expect(remaining.value.entries).toHaveLength(1);
        expect(remaining.value.entries[0]!.jobId).toBe(job2Result.value.id);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should delete referencing model entries before referenced model entries", async () => {
    const mockHttpClient = createMockHttpClient();
    const order: string[] = [];
    vi.mocked(mockHttpClient.post).mockImplementation(async (_url: string, body: string) => {
      const parsed = JSON.parse(body) as { query: string };
      const match = parsed.query.match(/delete(\w+)\(/);
      const name = match ? match[1] : "Unknown";
      order.push(name);
      return createMockResponse(200, { data: { [`delete${name}`]: { data: true, error: null } } });
    });

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const syncModels = tc.container.resolve(SyncProjectModelsRepository);
      await syncModels.execute({
        projectId: project.id,
        models: [
          {
            groupSlug: "blog",
            modelId: "article",
            name: "Article",
            singularApiName: "Article",
            pluralApiName: "Articles",
            fields: [
              makeField("title", "text"),
              makeField("author", "ref", { models: [{ modelId: "author" }] }),
            ],
            remoteId: "m1",
          },
          {
            groupSlug: "blog",
            modelId: "author",
            name: "Author",
            singularApiName: "Author",
            pluralApiName: "Authors",
            fields: [makeField("name", "text")],
            remoteId: "m2",
          },
        ],
      });

      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "author",
        entryId: "author-1#0001",
      });
      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "article-1#0001",
      });

      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.deleted).toBe(2);
      }

      expect(order.indexOf("Article")).toBeLessThan(order.indexOf("Author"));
    } finally {
      tc.cleanup();
    }
  });

  it("should count GraphQL errors per model and continue with remaining entries", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceedDelete());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const syncModels = tc.container.resolve(SyncProjectModelsRepository);
      await syncModels.execute({
        projectId: project.id,
        models: [
          {
            groupSlug: "blog",
            modelId: "article",
            name: "Article",
            singularApiName: "Article",
            pluralApiName: "Articles",
            fields: [makeField("title", "text")],
            remoteId: "m1",
          },
        ],
      });

      let callCount = 0;
      vi.mocked(mockHttpClient.post).mockReset();
      vi.mocked(mockHttpClient.post).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return createMockResponse(200, {
            data: {
              deleteArticle: { data: null, error: { message: "Cannot delete", code: "ERR" } },
            },
          });
        }
        return createMockResponse(200, { data: { deleteArticle: { data: true, error: null } } });
      });

      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-1#0001",
      });
      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "article",
        entryId: "entry-2#0001",
      });

      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.deleted).toBe(1);
        expect(result.value.errors).toBe(1);
        expect(result.value.models).toEqual([{ modelId: "article", deleted: 1, errors: 1 }]);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should return ProjectNotFoundError for a non-existent project", async () => {
    const tc = createTestContainer();
    try {
      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: "non-existent" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/NotFound");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should skip models not found locally and count their entries as errors", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockImplementation(autoSucceedDelete());

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);

      await seedCreatedEntry(tc, {
        projectId: project.id,
        modelId: "ghost",
        entryId: "ghost-1#0001",
      });

      vi.mocked(mockHttpClient.post).mockReset();
      vi.mocked(mockHttpClient.post).mockImplementation(autoSucceedDelete());

      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.deleted).toBe(0);
        expect(result.value.errors).toBe(1);
        expect(result.value.models).toEqual([{ modelId: "ghost", deleted: 0, errors: 1 }]);
      }
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    } finally {
      tc.cleanup();
    }
  });

  it("should return an empty result when there are no created entries", async () => {
    const tc = createTestContainer();
    try {
      const project = await setupProject(tc);
      const service = tc.container.resolve(CleanupService);
      const result = await service.execute({ projectId: project.id });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({ deleted: 0, errors: 0, models: [] });
      }
    } finally {
      tc.cleanup();
    }
  });
});
