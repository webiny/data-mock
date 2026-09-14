import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "../feature.js";
import { createServer } from "../server.js";
import { registerApiRoutes } from "../routes/index.js";
import type { FastifyInstance } from "fastify";

describe("Project API routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  describe("POST /api/projects", () => {
    it("should create a project and return 201", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Test Project",
          apiUrl: "https://api.example.com",
          apiToken: "test-token-123",
          tenant: "root",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.project).toBeDefined();
      expect(body.project.name).toBe("Test Project");
      expect(body.project.name).toBeDefined();
      expect(body.project.operationsVersion).toBe("6.0.0");
      expect(body.project.id).toBeDefined();
    });

    it("should return 400 for invalid body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("Validation/Error");
    });
  });

  describe("GET /api/projects", () => {
    it("should return empty list when no projects", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.projects.items).toEqual([]);
      expect(body.projects.total).toBe(0);
    });

    it("should return created projects", async () => {
      await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project A",
          apiUrl: "https://a.example.com",
          apiToken: "token-a",
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project B",
          apiUrl: "https://b.example.com",
          apiToken: "token-b",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.projects.items).toHaveLength(2);
      expect(body.projects.total).toBe(2);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("should return a project by ID", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "My Project",
          apiUrl: "https://api.example.com",
          apiToken: "token-123",
        },
      });

      const created = createResponse.json();
      const id = created.project.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.project.id).toBe(id);
      expect(body.project.name).toBe("My Project");
    });

    it("should return 404 for non-existent project", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/non-existent-id",
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe("Project/NotFound");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    async function createProject(name: string): Promise<string> {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name,
          apiUrl: "https://api.example.com",
          apiToken: "token-del",
        },
      });

      return response.json().project.id as string;
    }

    it("should archive a project rather than delete it", async () => {
      const id = await createProject("To Archive");

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/projects/${id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);
      expect(deleteResponse.json().project.archivedAt).toEqual(expect.any(Number));

      // The project is hidden from the default listing but still readable, so it can be restored.
      const listResponse = await app.inject({ method: "GET", url: "/api/projects" });
      expect(listResponse.json().projects.items).toHaveLength(0);

      const getResponse = await app.inject({ method: "GET", url: `/api/projects/${id}` });
      expect(getResponse.statusCode).toBe(200);
    });

    it("should list archived projects when asked", async () => {
      const id = await createProject("To Archive");
      await app.inject({ method: "DELETE", url: `/api/projects/${id}` });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects?includeArchived=true",
      });

      expect(response.json().projects.items).toHaveLength(1);
    });

    it("should restore an archived project", async () => {
      const id = await createProject("To Restore");
      await app.inject({ method: "DELETE", url: `/api/projects/${id}` });

      const restoreResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${id}/restore`,
      });

      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json().project.archivedAt).toBeNull();

      const listResponse = await app.inject({ method: "GET", url: "/api/projects" });
      expect(listResponse.json().projects.items).toHaveLength(1);
    });

    it("should keep the original archivedAt when archiving twice", async () => {
      const id = await createProject("To Archive Twice");

      const first = await app.inject({ method: "DELETE", url: `/api/projects/${id}` });
      const second = await app.inject({ method: "DELETE", url: `/api/projects/${id}` });

      expect(second.json().project.archivedAt).toBe(first.json().project.archivedAt);
    });

    it("should return 404 when archiving non-existent project", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/non-existent-id",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/purge", () => {
    it("should permanently delete a project and return 204", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "To Purge",
          apiUrl: "https://api.example.com",
          apiToken: "token-purge",
        },
      });

      const id = createResponse.json().project.id;

      const purgeResponse = await app.inject({
        method: "DELETE",
        url: `/api/projects/${id}/purge`,
      });

      expect(purgeResponse.statusCode).toBe(204);

      const getResponse = await app.inject({ method: "GET", url: `/api/projects/${id}` });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 404 when purging non-existent project", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/non-existent-id/purge",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/deletion-impact", () => {
    it("should count the environment a purge would destroy", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "With Data",
          apiUrl: "https://api.example.com",
          apiToken: "token-impact",
        },
      });

      const id = createResponse.json().project.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${id}/deletion-impact`,
      });

      expect(response.statusCode).toBe(200);
      // Creating a remote-only project seeds exactly one environment.
      expect(response.json().impact.environments).toBe(1);
      expect(response.json().impact.seedEntries).toBe(0);
    });

    it("should return 404 for a non-existent project", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/non-existent-id/deletion-impact",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
