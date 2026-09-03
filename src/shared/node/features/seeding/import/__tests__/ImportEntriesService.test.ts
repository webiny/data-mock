import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { SyncProjectModelsRepository } from "~/shared/node/features/models/sync/abstractions/SyncProjectModelsRepository.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { ImportEntriesService } from "../abstractions/ImportEntriesService.js";
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

async function setupProject(tc: ReturnType<typeof createTestContainer>) {
  const createUseCase = tc.container.resolve(CreateProjectUseCase);
  const result = await createUseCase.execute({
    name: "Import Project",
    apiUrl: "https://api.example.com/cms/manage",
    apiToken: "import-token",
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
        singularApiName: "Article",
        pluralApiName: "Articles",
        fields: [textField],
        remoteId: "m1",
      },
    ],
  });

  return result.value;
}

function listArticlesResponse(input: {
  data: Array<{ id: string; entryId: string; title: string }>;
  hasMoreItems: boolean;
  cursor: string | null;
}) {
  return {
    data: {
      listArticles: {
        data: input.data,
        meta: {
          totalCount: input.data.length,
          hasMoreItems: input.hasMoreItems,
          cursor: input.cursor,
        },
        error: null,
      },
    },
  };
}

describe("ImportEntriesService", () => {
  it("should import entries for a single page and store them as imported seed entries", async () => {
    const mockHttpClient = createMockHttpClient();

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);

      vi.mocked(mockHttpClient.post).mockReset();
      vi.mocked(mockHttpClient.post).mockResolvedValue(
        createMockResponse(
          200,
          listArticlesResponse({
            data: [
              { id: "entry-1", entryId: "entry-1", title: "First" },
              { id: "entry-2", entryId: "entry-2", title: "Second" },
            ],
            hasMoreItems: false,
            cursor: null,
          }),
        ),
      );

      const service = tc.container.resolve(ImportEntriesService);

      const result = await service.execute({
        projectId: project.id,
        tenant: "root",
        models: ["article"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.imported).toBe(2);
        expect(result.value.models).toEqual([{ modelId: "article", count: 2 }]);
      }

      const listSeedEntries = tc.container.resolve(ListSeedEntriesRepository);
      const entriesResult = await listSeedEntries.execute({
        projectId: project.id,
        status: "imported",
      });
      expect(entriesResult.isOk()).toBe(true);
      if (entriesResult.isOk()) {
        expect(entriesResult.value.entries).toHaveLength(2);
        expect(entriesResult.value.entries[0]!.jobId).toBeNull();
        expect(entriesResult.value.entries[0]!.status).toBe("imported");
      }

      const calls = vi.mocked(mockHttpClient.post).mock.calls;
      expect(calls).toHaveLength(1);
      const body = JSON.parse(calls[0]![1] as string) as { query: string };
      expect(body.query).toContain("listArticles");
    } finally {
      tc.cleanup();
    }
  });

  it("should paginate through multiple pages until hasMoreItems is false", async () => {
    const mockHttpClient = createMockHttpClient();

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);

      vi.mocked(mockHttpClient.post).mockReset();
      vi.mocked(mockHttpClient.post)
        .mockResolvedValueOnce(
          createMockResponse(
            200,
            listArticlesResponse({
              data: [{ id: "entry-1", entryId: "entry-1", title: "First" }],
              hasMoreItems: true,
              cursor: "cursor-1",
            }),
          ),
        )
        .mockResolvedValueOnce(
          createMockResponse(
            200,
            listArticlesResponse({
              data: [{ id: "entry-2", entryId: "entry-2", title: "Second" }],
              hasMoreItems: false,
              cursor: null,
            }),
          ),
        );

      const service = tc.container.resolve(ImportEntriesService);

      const result = await service.execute({
        projectId: project.id,
        tenant: "root",
        models: ["article"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.imported).toBe(2);
      }

      const calls = vi.mocked(mockHttpClient.post).mock.calls;
      expect(calls).toHaveLength(2);
      const secondBody = JSON.parse(calls[1]![1] as string) as {
        variables: { after: string | null };
      };
      expect(secondBody.variables.after).toBe("cursor-1");
    } finally {
      tc.cleanup();
    }
  });

  it("should return ProjectNotFoundError for a non-existent project", async () => {
    const tc = createTestContainer();
    try {
      const service = tc.container.resolve(ImportEntriesService);
      const result = await service.execute({
        projectId: "non-existent",
        tenant: "root",
        models: ["article"],
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/NotFound");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should return an error when a model is not found locally", async () => {
    const tc = createTestContainer();
    try {
      const project = await setupProject(tc);
      const service = tc.container.resolve(ImportEntriesService);

      const result = await service.execute({
        projectId: project.id,
        tenant: "root",
        models: ["non-existent-model"],
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/NotFound");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should return a GraphQLRequestError when the response contains a GraphQL error", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockResolvedValue(
      createMockResponse(200, {
        data: {
          listArticles: {
            data: null,
            meta: null,
            error: { message: "Model not found", code: "NOT_FOUND" },
          },
        },
      }),
    );

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const service = tc.container.resolve(ImportEntriesService);

      const result = await service.execute({
        projectId: project.id,
        tenant: "root",
        models: ["article"],
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toBe("Model not found");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("should return a GraphQLRequestError on non-200 HTTP status", async () => {
    const mockHttpClient = createMockHttpClient();
    vi.mocked(mockHttpClient.post).mockResolvedValue(
      createMockResponse(500, "Internal Server Error"),
    );

    const tc = createTestContainer({ httpClient: mockHttpClient });
    try {
      const project = await setupProject(tc);
      const service = tc.container.resolve(ImportEntriesService);

      const result = await service.execute({
        projectId: project.id,
        tenant: "root",
        models: ["article"],
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
      }
    } finally {
      tc.cleanup();
    }
  });
});
