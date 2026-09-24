import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { ApiFeature } from "~/api/feature.js";
import { createServer } from "~/api/server.js";
import { registerApiRoutes } from "~/api/routes/index.js";
import type { FastifyInstance } from "fastify";

describe("Deployment routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    const project = await createTestProject(tc, { name: "Deploy Target" });
    projectId = project.projectId;
    environmentId = project.environmentId;
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  function base(): string {
    return `/api/projects/${projectId}/environments/${environmentId}`;
  }

  describe("POST .../deploy", () => {
    it("enqueues a deploy job and returns 202", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${base()}/deploy`,
        payload: { apps: ["core"] },
      });

      expect(response.statusCode).toBe(202);
      const job = response.json().job;
      expect(job.type).toBe("deploy");
      expect(job.status).toBe("pending");
      expect(job.environmentId).toBe(environmentId);
      expect(JSON.parse(job.config)).toEqual({ environmentId, apps: ["core"] });
    });

    it("accepts an empty body, meaning every deployable app", async () => {
      const response = await app.inject({ method: "POST", url: `${base()}/deploy`, payload: {} });

      expect(response.statusCode).toBe(202);
      expect(JSON.parse(response.json().job.config)).toEqual({ environmentId });
    });
  });

  describe("POST .../destroy", () => {
    it("refuses without the project name typed back", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${base()}/destroy`,
        payload: { apps: ["admin"] },
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuses when the typed name does not match", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${base()}/destroy`,
        payload: { apps: ["admin"], confirmProjectName: "Deploy Targe" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain("Destroy not confirmed");
    });

    it("enqueues when the name matches exactly", async () => {
      const response = await app.inject({
        method: "POST",
        url: `${base()}/destroy`,
        payload: { apps: ["admin"], confirmProjectName: "Deploy Target" },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().job.type).toBe("destroy");
    });
  });

  describe("POST /api/projects/:projectId/jobs", () => {
    it("refuses to enqueue a destroy through the generic route", async () => {
      // That route's body is a bare config record, so accepting destroy here would route around
      // both confirmation steps.
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "destroy", config: { environmentId } },
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuses to enqueue a deploy through the generic route", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "deploy", config: { environmentId } },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/projects/:projectId/deployable-apps", () => {
    it("reports nothing deployable for a remote-only project", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/deployable-apps`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().deployable).toEqual({ apps: [], versionMajor: null });
    });
  });
});
