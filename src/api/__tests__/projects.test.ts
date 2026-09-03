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
      expect(body.project.apiUrl).toBe("https://api.example.com");
      expect(body.project.tenant).toBe("root");
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
    it("should remove a project and return 204", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "To Delete",
          apiUrl: "https://api.example.com",
          apiToken: "token-del",
        },
      });

      const id = createResponse.json().project.id;

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/projects/${id}`,
      });

      expect(deleteResponse.statusCode).toBe(204);

      const getResponse = await app.inject({
        method: "GET",
        url: `/api/projects/${id}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 404 when removing non-existent project", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/projects/non-existent-id",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
