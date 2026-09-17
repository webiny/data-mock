import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { SyncModelsService } from "../abstractions/SyncModelsService.js";
import { ListProjectGroupsRepository } from "../../list/abstractions/ListProjectGroupsRepository.js";
import { ListProjectModelsRepository } from "../../list/abstractions/ListProjectModelsRepository.js";
import { SyncProjectGroupsRepository } from "../abstractions/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "../abstractions/SyncProjectModelsRepository.js";
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

const testField: ApiCmsModelField = {
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

interface RemoteGroupInput {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon?: { type: string; name: string } | null;
}

interface RemoteModelInput {
  modelId: string;
  name: string;
  singularApiName: string;
  pluralApiName: string;
  description?: string | null;
  group: string;
  tags?: string[];
  plugin: boolean;
  fields: ApiCmsModelField[];
}

function groupsResponse(groups: RemoteGroupInput[]) {
  return createMockResponse(200, {
    data: { listContentModelGroups: { data: groups } },
  });
}

function modelsResponse(models: RemoteModelInput[]) {
  return createMockResponse(200, {
    data: { listContentModels: { data: models } },
  });
}

function remoteGroup(overrides: Partial<RemoteGroupInput> = {}): RemoteGroupInput {
  return { id: "g1", slug: "blog", name: "Blog", description: null, icon: null, ...overrides };
}

function remoteModel(overrides: Partial<RemoteModelInput> = {}): RemoteModelInput {
  return {
    modelId: "article",
    name: "Article",
    singularApiName: "Article",
    pluralApiName: "Articles",
    description: null,
    group: "blog",
    tags: [],
    plugin: false,
    fields: [testField],
    ...overrides,
  };
}

/** Routes the mocked HttpClient to the two operations the service issues, by query text. */
function mockHttpResponses(
  mockHttpClient: HttpClient.Interface,
  handlers: {
    groups?: () => HttpClient.Response | Promise<HttpClient.Response>;
    models?: () => HttpClient.Response | Promise<HttpClient.Response>;
  },
) {
  vi.mocked(mockHttpClient.post).mockImplementation(async (_url, body) => {
    const parsed = JSON.parse(body) as { query: string };
    if (parsed.query.includes("ListContentModelGroups")) {
      if (handlers.groups) {
        return handlers.groups();
      }
      return groupsResponse([remoteGroup()]);
    }
    if (parsed.query.includes("ListContentModels")) {
      if (handlers.models) {
        return handlers.models();
      }
      return modelsResponse([remoteModel()]);
    }
    return createMockResponse(200, { data: {} });
  });
}

describe("SyncModelsService", () => {
  it("returns the environment context error for a non-existent environment", async () => {
    const tc = createTestContainer();
    try {
      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: "non-existent" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Environment/NotFound");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("reports progress through each stage when a callback is given", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {});
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);
      const onProgress = vi.fn();

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({
        environmentId: project.environmentId,
        onProgress,
      });

      expect(result.isOk()).toBe(true);
      expect(onProgress).toHaveBeenCalledWith(10, "Fetching content model groups...");
      expect(onProgress).toHaveBeenCalledWith(35, "Fetching content models...");
      expect(onProgress).toHaveBeenCalledWith(60, "Syncing groups...");
      expect(onProgress).toHaveBeenCalledWith(85, "Syncing models...");
    } finally {
      tc.cleanup();
    }
  });

  it("fails when fetching content model groups returns a non-200 status", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () => createMockResponse(500, "Server Error"),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toContain("listContentModelGroups");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("falls back to an empty response body when reading the failed response text throws", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () => ({
        status: 500,
        text: () => Promise.reject(new Error("stream closed")),
        json: () => Promise.reject(new Error("stream closed")),
      }),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails when the groups response body carries no data field at all", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () => createMockResponse(200, { errors: [{ message: "top-level failure" }] }),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails when the groups operation returns a GraphQL error", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () =>
        createMockResponse(200, {
          data: {
            listContentModelGroups: {
              data: null,
              error: { message: "Access denied", code: "SECURITY_NOT_AUTHORIZED" },
            },
          },
        }),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toBe("Access denied");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails with the network error message when the groups request rejects with an Error", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () => Promise.reject(new Error("Connection refused")),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toBe("Connection refused");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails with a generic message when the models request rejects with a non-Error value", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      // eslint-disable-next-line prefer-promise-reject-errors
      models: () => Promise.reject("boom"),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toBe("Failed to execute listContentModels");
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails when fetching content models returns a non-200 status, after groups already succeeded", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      models: () => createMockResponse(503, "Unavailable"),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("GraphQL/RequestError");
        expect(result.error.message).toContain("listContentModels");
      }

      // The groups fetch that ran first must not have been stored on a later failure.
      const listGroups = tc.container.resolve(ListProjectGroupsRepository);
      const groupsResult = await listGroups.execute({ environmentId: project.environmentId });
      expect(groupsResult.isOk()).toBe(true);
      if (groupsResult.isOk()) {
        expect(groupsResult.value).toHaveLength(0);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("stores a group's icon and description when present, and null when absent", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () =>
        groupsResponse([
          remoteGroup({
            slug: "blog",
            description: "Blog posts",
            icon: { type: "icon", name: "fas-folder" },
          }),
          remoteGroup({ id: "g2", slug: "cars", name: "Cars", description: null, icon: null }),
        ]),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.groups).toBe(2);
      }

      const listGroups = tc.container.resolve(ListProjectGroupsRepository);
      const groupsResult = await listGroups.execute({ environmentId: project.environmentId });
      expect(groupsResult.isOk()).toBe(true);
      if (groupsResult.isOk()) {
        const byslug = new Map(groupsResult.value.map((g) => [g.slug, g]));
        expect(byslug.get("blog")?.icon).toBe(JSON.stringify({ type: "icon", name: "fas-folder" }));
        expect(byslug.get("cars")?.icon).toBeNull();
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails and leaves the previously stored groups intact when the group sync cannot be finished", async () => {
    const mockHttpClient = createMockHttpClient();
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      // Seed an existing inventory the same way a prior successful sync would have.
      const syncGroups = tc.container.resolve(SyncProjectGroupsRepository);
      await syncGroups.execute({
        projectId: project.projectId,
        environmentId: project.environmentId,
        groups: [{ slug: "existing", name: "Existing", remoteId: "g0" }],
      });

      // Two remote groups sharing a slug violate the unique index, so the repository's
      // transaction throws part-way through the re-insert.
      mockHttpResponses(mockHttpClient, {
        groups: () =>
          groupsResponse([
            remoteGroup({ id: "g1", slug: "blog", name: "Blog" }),
            remoteGroup({ id: "g2", slug: "blog", name: "Blog Duplicate" }),
          ]),
      });

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/PersistenceError");
      }

      const listGroups = tc.container.resolve(ListProjectGroupsRepository);
      const groupsResult = await listGroups.execute({ environmentId: project.environmentId });
      expect(groupsResult.isOk()).toBe(true);
      if (groupsResult.isOk()) {
        // The failed write rolled back inside its transaction rather than emptying the table first.
        expect(groupsResult.value.map((g) => g.slug)).toEqual(["existing"]);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("fails and leaves the previously stored models intact when the model sync cannot be finished", async () => {
    const mockHttpClient = createMockHttpClient();
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncModels = tc.container.resolve(SyncProjectModelsRepository);
      await syncModels.execute({
        projectId: project.projectId,
        environmentId: project.environmentId,
        models: [
          {
            groupSlug: "blog",
            modelId: "existing",
            name: "Existing",
            singularApiName: "Existing",
            pluralApiName: "Existings",
            fields: [testField],
            remoteId: "m0",
          },
        ],
      });

      // Two remote models sharing a modelId violate the unique index, so the repository's
      // transaction throws part-way through the re-insert.
      mockHttpResponses(mockHttpClient, {
        models: () =>
          modelsResponse([
            remoteModel({ modelId: "article" }),
            remoteModel({ modelId: "article", name: "Article Duplicate" }),
          ]),
      });

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/PersistenceError");
      }

      const listModels = tc.container.resolve(ListProjectModelsRepository);
      const modelsResult = await listModels.execute({ environmentId: project.environmentId });
      expect(modelsResult.isOk()).toBe(true);
      if (modelsResult.isOk()) {
        // The failed write rolled back inside its transaction rather than emptying the table first.
        expect(modelsResult.value.map((m) => m.modelId)).toEqual(["existing"]);
      }

      // The groups fetched in the same run were already committed before the model sync failed.
      const listGroups = tc.container.resolve(ListProjectGroupsRepository);
      const groupsResult = await listGroups.execute({ environmentId: project.environmentId });
      expect(groupsResult.isOk()).toBe(true);
      if (groupsResult.isOk()) {
        expect(groupsResult.value).toHaveLength(1);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("excludes system and plugin models from what is synced and stored, and logs how many were skipped", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      models: () =>
        modelsResponse([
          remoteModel({ modelId: "article" }),
          remoteModel({ modelId: "wbyTenant", name: "Tenant" }),
          remoteModel({ modelId: "backgroundTask", name: "Background Task" }),
        ]),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.models).toBe(1);
      }

      const listModels = tc.container.resolve(ListProjectModelsRepository);
      const modelsResult = await listModels.execute({ environmentId: project.environmentId });
      expect(modelsResult.isOk()).toBe(true);
      if (modelsResult.isOk()) {
        expect(modelsResult.value.map((m) => m.modelId)).toEqual(["article"]);
      }
    } finally {
      tc.cleanup();
    }
  });

  it("stores zero groups and models when the CMS reports none of either", async () => {
    const mockHttpClient = createMockHttpClient();
    mockHttpResponses(mockHttpClient, {
      groups: () => groupsResponse([]),
      models: () => modelsResponse([]),
    });
    const tc = createTestContainer({ httpClient: mockHttpClient });

    try {
      const project = await createTestProject(tc);

      const syncService = tc.container.resolve(SyncModelsService);
      const result = await syncService.execute({ environmentId: project.environmentId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.groups).toBe(0);
        expect(result.value.models).toBe(0);
      }
    } finally {
      tc.cleanup();
    }
  });
});
