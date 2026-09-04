import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "../feature.js";
import { createServer } from "../server.js";
import { registerApiRoutes } from "../routes/index.js";
import type { FastifyInstance } from "fastify";

describe("Seeding API routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;

  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Seeding Test Project",
        apiUrl: "https://api.example.com",
        apiToken: "test-token",
        tenant: "root",
      },
    });
    projectId = createResponse.json().project.id;
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  const validBody = {
    tenant: "root",
    models: [{ modelId: "product", amount: 10 }],
    batchSize: 5,
  };

  describe("POST /api/projects/:projectId/seed", () => {
    it("should accept a valid body and return 202 with a job", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: validBody,
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.job).toBeDefined();
      expect(body.job.id).toBeDefined();
    });

    it("should accept optional fields (revisions, publishStrategy, publishPercent, includeUnpublish, dryRun)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 10, revisions: { min: 2, max: 5 } }],
          publishStrategy: "random",
          publishPercent: 50,
          includeUnpublish: true,
          dryRun: true,
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(202);
    });

    it("should reject an empty tenant", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { ...validBody, tenant: "" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("Validation/Error");
    });

    it("should reject a missing models array", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { tenant: "root", batchSize: 1 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject an empty modelId", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "", amount: 10 }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject amount below 1", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 0 }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject amount above 100000", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 100001 }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject a non-integer revisions number above 50", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 10, revisions: 51 }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject revisions object where min > max", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 10, revisions: { min: 10, max: 2 } }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject revisions object where max exceeds 50", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 10, revisions: { min: 1, max: 51 } }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should accept a valid revisions range object", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: {
          tenant: "root",
          models: [{ modelId: "product", amount: 10, revisions: { min: 1, max: 50 } }],
          batchSize: 1,
        },
      });

      expect(response.statusCode).toBe(202);
    });

    it("should reject an invalid publishStrategy", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { ...validBody, publishStrategy: "invalid" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject publishPercent of 0", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { ...validBody, publishPercent: 0 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject publishPercent above 100", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { ...validBody, publishPercent: 101 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject batchSize above 50", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { ...validBody, batchSize: 51 },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject a missing batchSize", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/seed`,
        payload: { tenant: "root", models: [{ modelId: "product", amount: 10 }] },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
