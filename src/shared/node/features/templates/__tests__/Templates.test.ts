import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { CreateSeedTemplateRepository } from "../create/abstractions/CreateSeedTemplateRepository.js";
import { ListSeedTemplatesRepository } from "../list/abstractions/ListSeedTemplatesRepository.js";
import { GetSeedTemplateRepository } from "../get/abstractions/GetSeedTemplateRepository.js";
import { DeleteSeedTemplateRepository } from "../delete/abstractions/DeleteSeedTemplateRepository.js";

describe("Templates Feature", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "Template Project",
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

  describe("CreateSeedTemplateRepository", () => {
    it("should create a seed template", async () => {
      const repo = tc.container.resolve(CreateSeedTemplateRepository);
      const result = await repo.execute({
        projectId,
        name: "Blog Template",
        config: { tenant: "root", models: [{ modelId: "article", amount: 10 }] },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBeDefined();
        expect(result.value.projectId).toBe(projectId);
        expect(result.value.name).toBe("Blog Template");
        expect(result.value.config.models).toHaveLength(1);
        expect(result.value.createdAt).toBeGreaterThan(0);
      }
    });
  });

  describe("ListSeedTemplatesRepository", () => {
    it("should return empty array when no templates exist", async () => {
      const repo = tc.container.resolve(ListSeedTemplatesRepository);
      const result = await repo.execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });

    it("should list templates for a project", async () => {
      const createRepo = tc.container.resolve(CreateSeedTemplateRepository);
      const listRepo = tc.container.resolve(ListSeedTemplatesRepository);

      await createRepo.execute({
        projectId,
        name: "Template A",
        config: { tenant: "root", models: [{ modelId: "article", amount: 5 }] },
      });
      await createRepo.execute({
        projectId,
        name: "Template B",
        config: { tenant: "root", models: [{ modelId: "author", amount: 3 }] },
      });

      const result = await listRepo.execute({ projectId });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        const names = result.value.map((t) => t.name);
        expect(names).toContain("Template A");
        expect(names).toContain("Template B");
      }
    });
  });

  describe("GetSeedTemplateRepository", () => {
    it("should get a template by id", async () => {
      const createRepo = tc.container.resolve(CreateSeedTemplateRepository);
      const getRepo = tc.container.resolve(GetSeedTemplateRepository);

      const createResult = await createRepo.execute({
        projectId,
        name: "Get Me",
        config: { tenant: "root", models: [{ modelId: "article", amount: 1 }] },
      });
      expect(createResult.isOk()).toBe(true);
      if (!createResult.isOk()) {
        return;
      }

      const result = await getRepo.execute({ id: createResult.value.id });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Get Me");
        expect(result.value.id).toBe(createResult.value.id);
      }
    });

    it("should return error for non-existent template", async () => {
      const repo = tc.container.resolve(GetSeedTemplateRepository);
      const result = await repo.execute({ id: "non-existent" });

      expect(result.isFail()).toBe(true);
    });
  });

  describe("DeleteSeedTemplateRepository", () => {
    it("should delete a template", async () => {
      const createRepo = tc.container.resolve(CreateSeedTemplateRepository);
      const deleteRepo = tc.container.resolve(DeleteSeedTemplateRepository);
      const listRepo = tc.container.resolve(ListSeedTemplatesRepository);

      const createResult = await createRepo.execute({
        projectId,
        name: "To Delete",
        config: { tenant: "root", models: [] },
      });
      expect(createResult.isOk()).toBe(true);
      if (!createResult.isOk()) {
        return;
      }

      const deleteResult = await deleteRepo.execute({ id: createResult.value.id });
      expect(deleteResult.isOk()).toBe(true);

      const listResult = await listRepo.execute({ projectId });
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        expect(listResult.value).toHaveLength(0);
      }
    });
  });
});
