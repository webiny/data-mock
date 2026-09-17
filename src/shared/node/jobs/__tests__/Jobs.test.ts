import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { JobExecutorRegistry } from "../abstractions/JobExecutorRegistry.js";
import { JobRecoveryHelper } from "../JobRecoveryHelper.js";
import { DatabaseClient } from "~/shared/node/db/abstractions/DatabaseClient.js";
import { jobs } from "~/shared/node/db/schema.js";
import { eq } from "drizzle-orm";
import { ApiFeature } from "~/api/feature.js";
import { createServer } from "~/api/server.js";
import { registerApiRoutes } from "~/api/routes/index.js";
import type { FastifyInstance } from "fastify";

describe("Jobs System", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    const project = await createTestProject(tc);
    projectId = project.projectId;
    environmentId = project.environmentId;
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("JobWorker", () => {
    it("should enqueue a job and return an id", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id = await worker.enqueue({
        projectId,
        type: "seed",
        config: { tenant: "root", models: [{ modelId: "article", amount: 5 }] },
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should get a job by id", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id = await worker.enqueue({ projectId, type: "pull-tenants" });

      const job = await worker.getJob(id);
      expect(job).not.toBeNull();
      expect(job!.id).toBe(id);
      expect(job!.projectId).toBe(projectId);
      expect(job!.type).toBe("pull-tenants");
      expect(job!.status).toBe("pending");
      expect(job!.createdAt).toBeGreaterThan(0);
    });

    it("should return null for non-existent job", async () => {
      const worker = tc.container.resolve(JobWorker);
      const job = await worker.getJob("non-existent");
      expect(job).toBeNull();
    });

    it("should list jobs for a project", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "pull-tenants" });
      await worker.enqueue({ projectId, type: "cleanup" });

      const all = await worker.listJobs({ projectId });
      expect(all.jobs).toHaveLength(3);
      expect(all.total).toBe(3);
      expect(all.jobs.map((j) => j.type).sort()).toEqual(["cleanup", "pull-tenants", "seed"]);
    });

    it("should list jobs filtered by status", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "pull-tenants" });

      const pending = await worker.listJobs({ projectId, status: "pending" });
      expect(pending.jobs).toHaveLength(2);
      expect(pending.total).toBe(2);

      const running = await worker.listJobs({ projectId, status: "running" });
      expect(running.jobs).toHaveLength(0);
      expect(running.total).toBe(0);
    });

    it("should return empty array for project with no jobs", async () => {
      const worker = tc.container.resolve(JobWorker);
      const result = await worker.listJobs({ projectId: "non-existent-project" });
      expect(result.jobs).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should enqueue a global job with a null projectId", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id = await worker.enqueue({
        projectId: null,
        type: "pull-picsum",
        config: { count: 5 },
      });

      const job = await worker.getJob(id);
      expect(job).not.toBeNull();
      expect(job!.projectId).toBeNull();
      expect(job!.type).toBe("pull-picsum");
    });

    it("should list all jobs across projects when no projectId is given", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId: null, type: "pull-picsum" });

      const all = await worker.listJobs({});
      expect(all.total).toBe(2);
      expect(all.jobs.map((j) => j.type).sort()).toEqual(["pull-picsum", "seed"]);
    });

    it("should filter jobs by type", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "cleanup" });

      const seeds = await worker.listJobs({ projectId, type: "seed" });
      expect(seeds.jobs).toHaveLength(2);
      expect(seeds.total).toBe(2);
      expect(seeds.jobs.every((j) => j.type === "seed")).toBe(true);
    });

    it("should paginate jobs with limit and offset", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "pull-tenants" });
      await worker.enqueue({ projectId, type: "cleanup" });
      await worker.enqueue({ projectId, type: "import" });

      const page1 = await worker.listJobs({ projectId, limit: 2, offset: 0 });
      expect(page1.jobs).toHaveLength(2);
      expect(page1.total).toBe(4);

      const page2 = await worker.listJobs({ projectId, limit: 2, offset: 2 });
      expect(page2.jobs).toHaveLength(2);
      expect(page2.total).toBe(4);

      const page1Ids = new Set(page1.jobs.map((j) => j.id));
      const page2Ids = new Set(page2.jobs.map((j) => j.id));
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false);
      }
    });

    it("should sort jobs by createdAt ascending", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "cleanup" });

      const result = await worker.listJobs({ projectId, sortField: "createdAt", sortDir: "asc" });
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0]!.createdAt).toBeLessThanOrEqual(result.jobs[1]!.createdAt);
    });

    it("should store config as JSON", async () => {
      const worker = tc.container.resolve(JobWorker);
      const config = { tenant: "root", models: [{ modelId: "article", amount: 3 }] };
      const id = await worker.enqueue({ projectId, type: "seed", config });

      const job = await worker.getJob(id);
      expect(job!.config).toBe(JSON.stringify(config));
    });

    it("narrows a list to one environment, leaving the project's other jobs out", async () => {
      const worker = tc.container.resolve(JobWorker);
      const scoped = await worker.enqueue({ projectId, environmentId, type: "seed" });
      await worker.enqueue({ projectId, type: "sync-system" });

      const result = await worker.listJobs({ environmentId });

      expect(result.total).toBe(1);
      expect(result.jobs.map((job) => job.id)).toEqual([scoped]);
    });

    it("leaves the log out of a list, and keeps it on the job itself", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id = await worker.enqueue({ projectId, type: "deploy" });
      const logLines = "Deploying core...\n".repeat(2000);
      tc.databaseClient.db.update(jobs).set({ logs: logLines }).where(eq(jobs.id, id)).run();

      const listed = await worker.listJobs({ projectId });

      // A page of fifty deploys would otherwise carry every line of every log to render a table
      // that shows none of them.
      expect(listed.jobs[0]).not.toHaveProperty("logs");

      const job = await worker.getJob(id);
      expect(job!.logs).toBe(logLines);
    });

    it("reads a job whose result is not valid JSON as having none", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id = await worker.enqueue({ projectId, type: "sync-preview" });
      // Written by an older build, or hand-edited: it must not take the whole row down.
      tc.databaseClient.db.update(jobs).set({ result: "{not json" }).where(eq(jobs.id, id)).run();

      const job = await worker.getJob(id);
      expect(job!.result).toBeNull();
    });

    it("should recover stale jobs on startup", async () => {
      const worker = tc.container.resolve(JobWorker);
      const id1 = await worker.enqueue({ projectId, type: "seed" });
      const id2 = await worker.enqueue({ projectId, type: "pull-tenants" });

      const db = tc.databaseClient.db;
      db.update(jobs).set({ status: "running" }).where(eq(jobs.id, id1)).run();

      await worker.recoverStaleJobs();

      const job1 = await worker.getJob(id1);
      const job2 = await worker.getJob(id2);
      expect(job1!.status).toBe("interrupted");
      expect(job2!.status).toBe("pending");
      expect(job1!.logs).toBe("Job interrupted by server restart");
    });
  });

  describe("JobExecutorRegistry", () => {
    it("resolves every job type to the executor that declares it", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);

      const types = [
        "seed",
        "pull-tenants",
        "pull-models",
        "cleanup",
        "import",
        "upload-files",
        "pull-picsum",
        "sync-system",
        "sync-preview",
        "deploy",
        "destroy",
      ];

      for (const type of types) {
        expect(registry.getExecutor(type).type).toBe(type);
      }
    });

    it("should throw for unknown executor type", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      expect(() => registry.getExecutor("unknown")).toThrow("No executor for job type: unknown");
    });
  });

  describe("JobRecoveryHelper", () => {
    it("should reset running jobs to interrupted, leave pending alone", async () => {
      const db = tc.databaseClient.db;
      const now = Date.now();

      db.insert(jobs)
        .values({
          id: "running-job",
          projectId,
          type: "seed",
          status: "running",
          startedAt: now - 5000,
          createdAt: now - 10000,
        })
        .run();

      db.insert(jobs)
        .values({
          id: "pending-job",
          projectId,
          type: "pull-tenants",
          status: "pending",
          createdAt: now - 8000,
        })
        .run();

      db.insert(jobs)
        .values({
          id: "completed-job",
          projectId,
          type: "cleanup",
          status: "completed",
          completedAt: now - 1000,
          createdAt: now - 15000,
        })
        .run();

      const dbClient = tc.container.resolve(DatabaseClient);
      const helper = new JobRecoveryHelper({
        databaseClient: dbClient,
        controllers: new Map(),
        inFlight: new Set(),
      });

      await helper.recoverStaleJobs();

      const runningJob = db.select().from(jobs).where(eq(jobs.id, "running-job")).get();
      const pendingJob = db.select().from(jobs).where(eq(jobs.id, "pending-job")).get();
      const completedJob = db.select().from(jobs).where(eq(jobs.id, "completed-job")).get();

      expect(runningJob!.status).toBe("interrupted");
      expect(runningJob!.completedAt).toBeGreaterThan(0);
      expect(runningJob!.logs).toBe("Job interrupted by server restart");

      expect(pendingJob!.status).toBe("pending");
      expect(pendingJob!.completedAt).toBeNull();

      expect(completedJob!.status).toBe("completed");
    });
  });
});

describe("Jobs API routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let projectId: string;
  let environmentId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Jobs API Project",
        apiUrl: "https://api.example.com",
        apiToken: "token",
        tenant: "root",
      },
    });
    projectId = createResponse.json().project.id;

    const environmentsResponse = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/environments`,
    });
    environmentId = environmentsResponse.json().environments.items[0].id;
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  describe("POST /api/projects/:id/jobs", () => {
    it("should enqueue a job and return 201", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: {
          type: "pull-tenants",
          config: { environmentId },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.job).toBeDefined();
      expect(body.job.id).toBeDefined();
      expect(body.job.projectId).toBe(projectId);
      expect(body.job.type).toBe("pull-tenants");
      expect(body.job.status).toBe("pending");
    });

    it("should accept config in the request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: {
          type: "seed",
          config: { environmentId, tenant: "root", models: [{ modelId: "article", amount: 5 }] },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.job.type).toBe("seed");
      expect(body.job.config).not.toBeNull();
    });

    it("should return 400 for invalid job type", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: {
          type: "invalid-type",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/projects/:id/jobs", () => {
    it("should return empty list when no jobs", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.jobs.items).toEqual([]);
      expect(body.jobs.total).toBe(0);
    });

    it("should paginate jobs via query params", async () => {
      for (const type of ["seed", "pull-tenants", "cleanup", "import"] as const) {
        await app.inject({
          method: "POST",
          url: `/api/projects/${projectId}/jobs`,
          payload: { type, config: { environmentId } },
        });
      }

      const page1 = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs?page=1&limit=2`,
      });
      expect(page1.statusCode).toBe(200);
      const body1 = page1.json();
      expect(body1.jobs.items).toHaveLength(2);
      expect(body1.jobs.total).toBe(4);

      const page2 = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs?page=2&limit=2`,
      });
      const body2 = page2.json();
      expect(body2.jobs.items).toHaveLength(2);
      expect(body2.jobs.total).toBe(4);
    });

    it("should filter jobs by type", async () => {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "seed", config: { environmentId } },
      });
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "cleanup", config: { environmentId } },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs?type=seed`,
      });
      const body = response.json();
      expect(body.jobs.items).toHaveLength(1);
      expect(body.jobs.total).toBe(1);
      expect(body.jobs.items[0].type).toBe("seed");
    });

    it("should filter jobs by status", async () => {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "seed", config: { environmentId } },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs?status=pending`,
      });
      const body = response.json();
      expect(body.jobs.items).toHaveLength(1);
      expect(body.jobs.total).toBe(1);

      const noResults = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs?status=running`,
      });
      expect(noResults.json().jobs.items).toHaveLength(0);
    });

    it("should list enqueued jobs", async () => {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "pull-tenants", config: { environmentId } },
      });
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "pull-models", config: { environmentId } },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.jobs.items).toHaveLength(2);
      expect(body.jobs.total).toBe(2);
    });
  });

  describe("GET /api/projects/:id/jobs/:jobId", () => {
    it("should return a job by id", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "cleanup", config: { environmentId } },
      });
      const jobId = createResponse.json().job.id;

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs/${jobId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job.id).toBe(jobId);
      expect(body.job.type).toBe("cleanup");
    });

    it("should return 404 for non-existent job", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/jobs/non-existent`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/jobs (global)", () => {
    it("should list jobs across all projects, including global (null-projectId) jobs", async () => {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "seed", config: { environmentId } },
      });

      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId: null, type: "pull-picsum", config: { count: 3 } });

      const response = await app.inject({ method: "GET", url: "/api/jobs" });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.jobs.total).toBe(2);
      const globalJob = body.jobs.items.find((job: { type: string }) => job.type === "pull-picsum");
      expect(globalJob).toBeDefined();
      expect(globalJob.projectId).toBeNull();
    });
  });
});
