import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "../create/abstractions/CreateProjectUseCase.js";
import { GetProjectUseCase } from "../get/abstractions/GetProjectUseCase.js";
import { ListProjectsUseCase } from "../list/abstractions/ListProjectsUseCase.js";
import { RemoveProjectUseCase } from "../remove/abstractions/RemoveProjectUseCase.js";

describe("Project Use Cases", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("CreateProjectUseCase", () => {
    it("should create a project and return it", async () => {
      const useCase = tc.container.resolve(CreateProjectUseCase);

      const result = await useCase.execute({
        name: "Test Project",
        apiUrl: "https://api.example.com",
        apiToken: "secret-token-123",
        tenant: "root",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe("Test Project");
        expect(result.value.apiUrl).toBe("https://api.example.com");
        expect(result.value.apiToken).toBe("secret-token-123");
        expect(result.value.tenant).toBe("root");
        expect(result.value.id).toBeDefined();
        expect(result.value.webinyVersion).toBe("6.0.0");
      }
    });

    it("should encrypt the API token in the database", async () => {
      const useCase = tc.container.resolve(CreateProjectUseCase);

      const result = await useCase.execute({
        name: "Encrypted Project",
        apiUrl: "https://api.example.com",
        apiToken: "my-plaintext-token",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const rows = tc.databaseClient.db.all<{ api_token: string }>(
          sql`SELECT api_token FROM projects WHERE id = ${result.value.id}`,
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]!.api_token).not.toBe("my-plaintext-token");
        expect(rows[0]!.api_token).toContain(":");
      }
    });

    it("should store the webiny version", async () => {
      const useCase = tc.container.resolve(CreateProjectUseCase);

      const result = await useCase.execute({
        name: "Versioned Project",
        apiUrl: "https://api.example.com",
        apiToken: "token",
        webinyVersion: "6.4.9",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.webinyVersion).toBe("6.4.9");
      }
    });

    it("should return validation error for empty name", async () => {
      const useCase = tc.container.resolve(CreateProjectUseCase);

      const result = await useCase.execute({
        name: "",
        apiUrl: "https://api.example.com",
        apiToken: "token",
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Validation/Error");
      }
    });

    it("should return validation error for invalid URL", async () => {
      const useCase = tc.container.resolve(CreateProjectUseCase);

      const result = await useCase.execute({
        name: "Bad URL Project",
        apiUrl: "not-a-url",
        apiToken: "token",
      });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Validation/Error");
      }
    });
  });

  describe("GetProjectUseCase", () => {
    it("should return a project by ID with decrypted token", async () => {
      const createUseCase = tc.container.resolve(CreateProjectUseCase);
      const getUseCase = tc.container.resolve(GetProjectUseCase);

      const createResult = await createUseCase.execute({
        name: "Get Me",
        apiUrl: "https://api.example.com",
        apiToken: "secret-get-token",
      });

      expect(createResult.isOk()).toBe(true);
      if (!createResult.isOk()) {return;}

      const getResult = await getUseCase.execute({ id: createResult.value.id });

      expect(getResult.isOk()).toBe(true);
      if (getResult.isOk()) {
        expect(getResult.value.apiToken).toBe("secret-get-token");
        expect(getResult.value.name).toBe("Get Me");
      }
    });

    it("should return not found for non-existent ID", async () => {
      const useCase = tc.container.resolve(GetProjectUseCase);

      const result = await useCase.execute({ id: "non-existent" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/NotFound");
      }
    });
  });

  describe("ListProjectsUseCase", () => {
    it("should return empty list when no projects", async () => {
      const useCase = tc.container.resolve(ListProjectsUseCase);

      const result = await useCase.execute();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.projects).toEqual([]);
        expect(result.value.total).toBe(0);
      }
    });

    it("should return all projects with decrypted tokens", async () => {
      const createUseCase = tc.container.resolve(CreateProjectUseCase);
      const listUseCase = tc.container.resolve(ListProjectsUseCase);

      await createUseCase.execute({
        name: "Project A",
        apiUrl: "https://a.example.com",
        apiToken: "token-a",
      });

      await createUseCase.execute({
        name: "Project B",
        apiUrl: "https://b.example.com",
        apiToken: "token-b",
      });

      const result = await listUseCase.execute();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.projects).toHaveLength(2);
        expect(result.value.total).toBe(2);

        const tokens = result.value.projects.map((p) => p.apiToken);
        expect(tokens).toContain("token-a");
        expect(tokens).toContain("token-b");
      }
    });
  });

  describe("RemoveProjectUseCase", () => {
    it("should remove a project", async () => {
      const createUseCase = tc.container.resolve(CreateProjectUseCase);
      const removeUseCase = tc.container.resolve(RemoveProjectUseCase);
      const getUseCase = tc.container.resolve(GetProjectUseCase);

      const createResult = await createUseCase.execute({
        name: "To Remove",
        apiUrl: "https://api.example.com",
        apiToken: "token-remove",
      });

      expect(createResult.isOk()).toBe(true);
      if (!createResult.isOk()) {return;}

      const removeResult = await removeUseCase.execute({ id: createResult.value.id });
      expect(removeResult.isOk()).toBe(true);

      const getResult = await getUseCase.execute({ id: createResult.value.id });
      expect(getResult.isFail()).toBe(true);
      if (getResult.isFail()) {
        expect(getResult.error.code).toBe("Project/NotFound");
      }
    });

    it("should return not found for non-existent project", async () => {
      const useCase = tc.container.resolve(RemoveProjectUseCase);

      const result = await useCase.execute({ id: "non-existent" });

      expect(result.isFail()).toBe(true);
      if (result.isFail()) {
        expect(result.error.code).toBe("Project/NotFound");
      }
    });
  });
});
