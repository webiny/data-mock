import { describe, it, expect, vi } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { ListProjectGroupsRepository } from "../list/abstractions/ListProjectGroupsRepository.js";
import { ListProjectModelsRepository } from "../list/abstractions/ListProjectModelsRepository.js";
import { SyncProjectGroupsRepository } from "../sync/abstractions/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "../sync/abstractions/SyncProjectModelsRepository.js";
import { GetProjectModelRepository } from "../get/abstractions/GetProjectModelRepository.js";
import { SyncModelsService } from "../sync/abstractions/SyncModelsService.js";
import { CompareModelsService } from "../sync/abstractions/CompareModelsService.js";
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

describe("Models Feature", () => {
  describe("ListProjectGroupsRepository", () => {
    it("should return empty array when no groups stored", async () => {
      const tc = createTestContainer();
      try {
        const repo = tc.container.resolve(ListProjectGroupsRepository);
        const result = await repo.execute({ projectId: "any-id" });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual([]);
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return stored groups", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectGroupsRepository);
        await syncRepo.execute({
          projectId: project.id,
          groups: [
            { slug: "blog", name: "Blog", description: "Blog group", remoteId: "g1" },
            { slug: "cars", name: "Cars", remoteId: "g2" },
          ],
        });

        const listRepo = tc.container.resolve(ListProjectGroupsRepository);
        const result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(2);
          expect(result.value.map((g) => g.slug)).toEqual(["blog", "cars"]);
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("ListProjectModelsRepository", () => {
    it("should return empty array when no models stored", async () => {
      const tc = createTestContainer();
      try {
        const repo = tc.container.resolve(ListProjectModelsRepository);
        const result = await repo.execute({ projectId: "any-id" });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toEqual([]);
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return stored models with parsed JSON fields", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectModelsRepository);
        await syncRepo.execute({
          projectId: project.id,
          models: [
            {
              groupSlug: "blog",
              modelId: "article",
              name: "Article",
              singularApiName: "Article",
              pluralApiName: "Articles",
              fields: [testField],
              remoteId: "m1",
            },
          ],
        });

        const listRepo = tc.container.resolve(ListProjectModelsRepository);
        const result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(1);
          expect(result.value[0]!.modelId).toBe("article");
          expect(result.value[0]!.fields).toHaveLength(1);
          expect(result.value[0]!.fields[0]!.fieldId).toBe("title");
          expect(result.value[0]!.fields[0]!.type).toBe("text");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("SyncProjectGroupsRepository", () => {
    it("should replace groups on re-sync", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectGroupsRepository);
        const listRepo = tc.container.resolve(ListProjectGroupsRepository);

        await syncRepo.execute({
          projectId: project.id,
          groups: [{ slug: "old-group", name: "Old", remoteId: "g1" }],
        });

        let result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(1);
          expect(result.value[0]!.slug).toBe("old-group");
        }

        await syncRepo.execute({
          projectId: project.id,
          groups: [
            { slug: "new-group-1", name: "New 1", remoteId: "g2" },
            { slug: "new-group-2", name: "New 2", remoteId: "g3" },
          ],
        });

        result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(2);
          const slugs = result.value.map((g) => g.slug);
          expect(slugs).toContain("new-group-1");
          expect(slugs).toContain("new-group-2");
          expect(slugs).not.toContain("old-group");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("SyncProjectModelsRepository", () => {
    it("should replace models on re-sync", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectModelsRepository);
        const listRepo = tc.container.resolve(ListProjectModelsRepository);

        await syncRepo.execute({
          projectId: project.id,
          models: [
            {
              groupSlug: "blog",
              modelId: "old-model",
              name: "Old",
              singularApiName: "Old",
              pluralApiName: "Olds",
              fields: [testField],
              remoteId: "m1",
            },
          ],
        });

        let result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(1);
        }

        await syncRepo.execute({
          projectId: project.id,
          models: [
            {
              groupSlug: "blog",
              modelId: "new-model-1",
              name: "New 1",
              singularApiName: "New1",
              pluralApiName: "New1s",
              fields: [testField],
              remoteId: "m2",
            },
            {
              groupSlug: "blog",
              modelId: "new-model-2",
              name: "New 2",
              singularApiName: "New2",
              pluralApiName: "New2s",
              fields: [testField],
              remoteId: "m3",
            },
          ],
        });

        result = await listRepo.execute({ projectId: project.id });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toHaveLength(2);
          const ids = result.value.map((m) => m.modelId);
          expect(ids).toContain("new-model-1");
          expect(ids).toContain("new-model-2");
          expect(ids).not.toContain("old-model");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("GetProjectModelRepository", () => {
    it("should return a model by projectId and modelId", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const syncRepo = tc.container.resolve(SyncProjectModelsRepository);
        await syncRepo.execute({
          projectId: project.id,
          models: [
            {
              groupSlug: "blog",
              modelId: "article",
              name: "Article",
              singularApiName: "Article",
              pluralApiName: "Articles",
              fields: [testField],
              remoteId: "m1",
            },
          ],
        });

        const getRepo = tc.container.resolve(GetProjectModelRepository);
        const result = await getRepo.execute({
          projectId: project.id,
          modelId: "article",
        });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.modelId).toBe("article");
          expect(result.value.name).toBe("Article");
        }
      } finally {
        tc.cleanup();
      }
    });

    it("should return not found for non-existent model", async () => {
      const tc = createTestContainer();
      try {
        const project = await createProject(tc);
        const getRepo = tc.container.resolve(GetProjectModelRepository);
        const result = await getRepo.execute({
          projectId: project.id,
          modelId: "non-existent",
        });
        expect(result.isFail()).toBe(true);
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("SyncModelsService", () => {
    it("should fetch and store groups and models from Webiny", async () => {
      const mockHttpClient = createMockHttpClient();

      vi.mocked(mockHttpClient.post).mockImplementation(async (_url, body) => {
        const parsed = JSON.parse(body) as { query: string };
        if (parsed.query.includes("ListContentModelGroups")) {
          return createMockResponse(200, {
            data: {
              listContentModelGroups: {
                data: [
                  { id: "g1", slug: "blog", name: "Blog", description: "Blog posts", icon: "icon" },
                ],
              },
            },
          });
        }
        if (parsed.query.includes("ListContentModels")) {
          return createMockResponse(200, {
            data: {
              listContentModels: {
                data: [
                  {
                    modelId: "article",
                    name: "Article",
                    singularApiName: "Article",
                    pluralApiName: "Articles",
                    description: "Blog article",
                    group: "blog",
                    fields: [testField],
                  },
                ],
              },
            },
          });
        }
        return createMockResponse(200, { data: {} });
      });

      const tc = createTestContainer({ httpClient: mockHttpClient });
      try {
        const project = await createProject(tc);

        const syncService = tc.container.resolve(SyncModelsService);
        const result = await syncService.execute({ projectId: project.id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.groups).toBe(1);
          expect(result.value.models).toBe(1);
        }

        const listGroups = tc.container.resolve(ListProjectGroupsRepository);
        const groupsResult = await listGroups.execute({ projectId: project.id });
        expect(groupsResult.isOk()).toBe(true);
        if (groupsResult.isOk()) {
          expect(groupsResult.value).toHaveLength(1);
          expect(groupsResult.value[0]!.slug).toBe("blog");
        }

        const listModels = tc.container.resolve(ListProjectModelsRepository);
        const modelsResult = await listModels.execute({ projectId: project.id });
        expect(modelsResult.isOk()).toBe(true);
        if (modelsResult.isOk()) {
          expect(modelsResult.value).toHaveLength(1);
          expect(modelsResult.value[0]!.modelId).toBe("article");
        }
      } finally {
        tc.cleanup();
      }
    });
  });

  describe("CompareModelsService", () => {
    it("should detect added, removed, changed, and unchanged models", async () => {
      const mockHttpClient = createMockHttpClient();
      const tc = createTestContainer({ httpClient: mockHttpClient });

      try {
        const project = await createProject(tc);

        const syncModelsRepo = tc.container.resolve(SyncProjectModelsRepository);
        await syncModelsRepo.execute({
          projectId: project.id,
          models: [
            {
              groupSlug: "blog",
              modelId: "unchanged-model",
              name: "Unchanged",
              singularApiName: "Unchanged",
              pluralApiName: "Unchangeds",
              fields: [testField],
              remoteId: "m1",
            },
            {
              groupSlug: "blog",
              modelId: "changed-model",
              name: "Changed",
              singularApiName: "Changed",
              pluralApiName: "Changeds",
              fields: [testField],
              remoteId: "m2",
            },
            {
              groupSlug: "blog",
              modelId: "removed-model",
              name: "Removed",
              singularApiName: "Removed",
              pluralApiName: "Removeds",
              fields: [testField],
              remoteId: "m3",
            },
          ],
        });

        const changedField: ApiCmsModelField = {
          ...testField,
          type: "number",
        };

        const remoteResponse = createMockResponse(200, {
          data: {
            listContentModels: {
              data: [
                {
                  modelId: "unchanged-model",
                  name: "Unchanged",
                  singularApiName: "Unchanged",
                  pluralApiName: "Unchangeds",
                  fields: [testField],
                },
                {
                  modelId: "changed-model",
                  name: "Changed",
                  singularApiName: "Changed",
                  pluralApiName: "Changeds",
                  fields: [changedField],
                },
                {
                  modelId: "added-model",
                  name: "Added",
                  singularApiName: "Added",
                  pluralApiName: "Addeds",
                  fields: [testField],
                },
              ],
            },
          },
        });

        vi.mocked(mockHttpClient.post).mockResolvedValue(remoteResponse);

        const compareService = tc.container.resolve(CompareModelsService);
        const result = await compareService.execute({ projectId: project.id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          const items = result.value.items;
          const byStatus = new Map(items.map((i) => [i.modelId, i.status]));

          expect(byStatus.get("unchanged-model")).toBe("unchanged");
          expect(byStatus.get("changed-model")).toBe("changed");
          expect(byStatus.get("added-model")).toBe("added");
          expect(byStatus.get("removed-model")).toBe("removed");

          const changed = items.find((i) => i.modelId === "changed-model");
          expect(changed?.changes).toBeDefined();
          expect(changed!.changes!.length).toBeGreaterThan(0);
          expect(changed!.changes![0]).toContain("type changed");
        }
      } finally {
        tc.cleanup();
      }
    });
  });
});
