import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "~/api/feature.js";
import { createServer } from "~/api/server.js";
import { registerApiRoutes } from "~/api/routes/index.js";
import { createFixtureProject, stackResource } from "./fixtures.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";

describe("sync preview routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let fixture: ReturnType<typeof createFixtureProject>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    fixture = createFixtureProject({
      marker: "webiny.config.tsx",
      packageJson: { dependencies: { "@webiny/cli": "6.4.9" } },
      stacks: [{ app: "core", stackName: "dev", resources: [stackResource({})] }],
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Preview Routes", rootPath: fixture.rootPath },
    });
    projectId = created.json().project.id;
  });

  afterEach(async () => {
    await app.close();
    fixture.cleanup();
    tc.cleanup();
  });

  it("starts a preview job and hands back its id", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sync/preview",
      payload: { projectIds: [projectId] },
    });

    expect(response.statusCode).toBe(202);
    const job = response.json().job;
    expect(job.type).toBe("sync-preview");
    // No project of its own: it can cover several, and it writes nothing.
    expect(job.projectId).toBeNull();
    expect(job.status).toBe("pending");
  });

  it("refuses a preview with no projects", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sync/preview",
      payload: { projectIds: [] },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("serves the finished job, and its result, without a project in the path", async () => {
    const started = await app.inject({
      method: "POST",
      url: "/api/sync/preview",
      payload: { projectIds: [projectId] },
    });
    const jobId = started.json().job.id;

    const worker = tc.container.resolve(JobWorker);
    await worker.processNextJob();
    await worker.drain();

    const response = await app.inject({ method: "GET", url: `/api/jobs/${jobId}` });

    expect(response.statusCode).toBe(200);
    const job = response.json().job;
    expect(job.status).toBe("completed");
    expect(job.result.previews).toHaveLength(1);
    expect(job.result.previews[0].projectId).toBe(projectId);
  });

  it("cancels a preview that has not started yet", async () => {
    const started = await app.inject({
      method: "POST",
      url: "/api/sync/preview",
      payload: { projectIds: [projectId] },
    });
    const jobId = started.json().job.id;

    const response = await app.inject({ method: "POST", url: `/api/jobs/${jobId}/cancel` });

    expect(response.statusCode).toBe(200);
    expect(response.json().job.status).toBe("cancelled");

    // Cancelled means cancelled: the worker must not pick it up afterwards.
    const worker = tc.container.resolve(JobWorker);
    await worker.processNextJob();
    await worker.drain();

    const after = await app.inject({ method: "GET", url: `/api/jobs/${jobId}` });
    expect(after.json().job.status).toBe("cancelled");
  });

  it("404s an unknown job", async () => {
    const response = await app.inject({ method: "GET", url: "/api/jobs/nope" });

    expect(response.statusCode).toBe(404);
  });

  it("is not reachable through the generic enqueue route", async () => {
    // That route takes a bare config record; a preview belongs to its own endpoint.
    const response = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/jobs`,
      payload: { type: "sync-preview", config: { projectIds: [projectId] } },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
