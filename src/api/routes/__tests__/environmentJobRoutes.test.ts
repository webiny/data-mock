import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ApiFeature } from "~/api/feature.js";
import { createServer } from "~/api/server.js";
import { registerApiRoutes } from "~/api/routes/index.js";
import { JobWorker } from "~/shared/node/jobs/abstractions/JobWorker.js";

interface RecordedJob {
  type: string;
  environmentId: string | null;
  config: string | null;
}

/**
 * The four endpoints that start a job against one environment. Nothing here runs the queue, so no
 * job ever reaches a live CMS.
 */
describe("environment job routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let projectId: string;
  let environmentId: string;
  let otherProjectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Jobs", apiUrl: "https://api.example.com", apiToken: "token" },
    });
    projectId = created.json().project.id;

    const environments = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/environments`,
    });
    environmentId = environments.json().environments.items[0].id;

    const other = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { name: "Other", apiUrl: "https://other.example.com", apiToken: "token" },
    });
    otherProjectId = other.json().project.id;
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  async function jobs(): Promise<RecordedJob[]> {
    const listed = await tc.container.resolve(JobWorker).listJobs({ projectId });
    return listed.jobs.map((job) => ({
      type: job.type,
      environmentId: job.environmentId,
      config: job.config,
    }));
  }

  function url(suffix: string, project = projectId): string {
    return `/api/projects/${project}/environments/${environmentId}/${suffix}`;
  }

  it("starts a tenant pull against the environment in the path", async () => {
    const response = await app.inject({ method: "POST", url: url("tenants/pull") });

    expect(response.statusCode).toBe(202);
    expect(await jobs()).toEqual([{ type: "pull-tenants", environmentId, config: null }]);
  });

  it("starts a model pull against the environment in the path", async () => {
    const response = await app.inject({ method: "POST", url: url("models/pull") });

    expect(response.statusCode).toBe(202);
    expect(await jobs()).toEqual([{ type: "pull-models", environmentId, config: null }]);
  });

  it("carries the tenant and models an import was asked for", async () => {
    const response = await app.inject({
      method: "POST",
      url: url("import"),
      payload: { tenant: "root", models: ["article", "author"] },
    });

    expect(response.statusCode).toBe(202);
    const [job] = await jobs();
    expect(JSON.parse(job?.config ?? "{}")).toEqual({
      tenant: "root",
      models: ["article", "author"],
    });
  });

  it("refuses an import with no tenant named", async () => {
    const response = await app.inject({
      method: "POST",
      url: url("import"),
      payload: { models: ["article"] },
    });

    expect(response.statusCode).toBe(400);
    expect(await jobs()).toEqual([]);
  });

  it("scopes a cleanup to one seed job when it is given one", async () => {
    const response = await app.inject({
      method: "POST",
      url: url("cleanup"),
      payload: { jobId: "seed-1" },
    });

    expect(response.statusCode).toBe(202);
    const [job] = await jobs();
    expect(JSON.parse(job?.config ?? "{}")).toEqual({ jobId: "seed-1" });
  });

  it("cleans up everything seeded when no job is named", async () => {
    const response = await app.inject({ method: "POST", url: url("cleanup"), payload: {} });

    expect(response.statusCode).toBe(202);
    const [job] = await jobs();
    // No config at all: the executor reads that as every seeded entry in this environment.
    expect(job?.config).toBeNull();
  });

  it.each(["tenants/pull", "models/pull", "import", "cleanup"])(
    "refuses %s for an environment belonging to another project",
    async (suffix) => {
      const response = await app.inject({
        method: "POST",
        url: url(suffix, otherProjectId),
        payload: { tenant: "root", models: ["article"] },
      });

      expect(response.statusCode).toBe(404);
      expect(await jobs()).toEqual([]);
    },
  );

  it.each(["tenants/pull", "models/pull", "cleanup"])(
    "404s %s for an environment that does not exist",
    async (suffix) => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/environments/nope/${suffix}`,
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    },
  );
});
