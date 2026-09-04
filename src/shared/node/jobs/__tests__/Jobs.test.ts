import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
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

async function createProject(tc: ReturnType<typeof createTestContainer>): Promise<string> {
  const useCase = tc.container.resolve(CreateProjectUseCase);
  const result = await useCase.execute({
    name: "Job Test Project",
    apiUrl: "https://api.example.com",
    apiToken: "test-token",
    tenant: "root",
  });
  if (result.isFail()) {
    throw new Error(`Failed to create project: ${result.error.message}`);
  }
  return result.value.id;
}

describe("Jobs System", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    projectId = await createProject(tc);
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

      const all = await worker.listJobs(projectId);
      expect(all).toHaveLength(3);
      expect(all.map((j) => j.type).sort()).toEqual(["cleanup", "pull-tenants", "seed"]);
    });

    it("should list jobs filtered by status", async () => {
      const worker = tc.container.resolve(JobWorker);
      await worker.enqueue({ projectId, type: "seed" });
      await worker.enqueue({ projectId, type: "pull-tenants" });

      const pending = await worker.listJobs(projectId, "pending");
      expect(pending).toHaveLength(2);

      const running = await worker.listJobs(projectId, "running");
      expect(running).toHaveLength(0);
    });

    it("should return empty array for project with no jobs", async () => {
      const worker = tc.container.resolve(JobWorker);
      const result = await worker.listJobs("non-existent-project");
      expect(result).toEqual([]);
    });

    it("should store config as JSON", async () => {
      const worker = tc.container.resolve(JobWorker);
      const config = { tenant: "root", models: [{ modelId: "article", amount: 3 }] };
      const id = await worker.enqueue({ projectId, type: "seed", config });

      const job = await worker.getJob(id);
      expect(job!.config).toBe(JSON.stringify(config));
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
    it("should resolve seed executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("seed");
      expect(executor.type).toBe("seed");
    });

    it("should resolve pull-tenants executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("pull-tenants");
      expect(executor.type).toBe("pull-tenants");
    });

    it("should resolve pull-models executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("pull-models");
      expect(executor.type).toBe("pull-models");
    });

    it("should resolve cleanup executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("cleanup");
      expect(executor.type).toBe("cleanup");
    });

    it("should resolve import executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("import");
      expect(executor.type).toBe("import");
    });

    it("should resolve upload-files executor", () => {
      const registry = tc.container.resolve(JobExecutorRegistry);
      const executor = registry.getExecutor("upload-files");
      expect(executor.type).toBe("upload-files");
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
          config: { tenant: "root", models: [{ modelId: "article", amount: 5 }] },
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

    it("should list enqueued jobs", async () => {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "pull-tenants" },
      });
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/jobs`,
        payload: { type: "pull-models" },
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
        payload: { type: "cleanup" },
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
});
