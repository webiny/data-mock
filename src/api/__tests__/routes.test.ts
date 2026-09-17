import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import { ApiFeature } from "../feature.js";
import { createServer } from "../server.js";
import { registerApiRoutes } from "../routes/index.js";
import { CreateSeedEntryRepository } from "~/shared/node/features/seeding/entries/abstractions/CreateSeedEntryRepository.js";
import { SyncProjectFilesRepository } from "~/shared/node/features/files/sync/abstractions/SyncProjectFilesRepository.js";
import { VerifyProjectAccessService } from "~/shared/node/features/tenants/verify/abstractions/VerifyProjectAccessService.js";
import { GraphQLRequestError } from "~/shared/errors.js";
import type { FastifyInstance } from "fastify";
import type { SeedEntryStatus } from "~/shared/types.js";

interface Envelope {
  [key: string]: unknown;
}

describe("API routes", () => {
  let testContainer: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let project: ITestProject;

  beforeEach(async () => {
    testContainer = createTestContainer();
    ApiFeature.register(testContainer.container);
    app = await createServer(testContainer.container, [registerApiRoutes]);
    project = await createTestProject(testContainer, { name: "Routes Project" });
  });

  afterEach(async () => {
    await app.close();
    testContainer.cleanup();
  });

  function environmentPath(suffix: string): string {
    return `/api/projects/${project.projectId}/environments/${project.environmentId}${suffix}`;
  }

  async function body(response: { body: string }): Promise<Envelope> {
    return JSON.parse(response.body) as Envelope;
  }

  describe("GET /entries", () => {
    async function addEntry(
      modelId: string,
      status: SeedEntryStatus,
      tenant = "root",
    ): Promise<void> {
      await testContainer.container.resolve(CreateSeedEntryRepository).execute({
        jobId: null,
        projectId: project.projectId,
        environmentId: project.environmentId,
        tenant,
        modelId,
        entryId: `${modelId}-${status}-${tenant}`,
        entryData: {},
        requestData: null,
        responseData: null,
        httpStatus: 200,
        status,
        error: null,
      });
    }

    it("lists the entries of an environment", async () => {
      await addEntry("article", "created");
      await addEntry("author", "created");

      const response = await app.inject({ method: "GET", url: environmentPath("/entries") });

      expect(response.statusCode).toBe(200);
      const payload = await body(response);
      expect((payload.seedEntries as { items: unknown[]; total: number }).total).toBe(2);
    });

    it("narrows on a model, a tenant and a status", async () => {
      await addEntry("article", "created");
      await addEntry("author", "created");
      await addEntry("article", "failed");
      await addEntry("article", "created", "acme");

      const byModel = await app.inject({
        method: "GET",
        url: environmentPath("/entries?modelId=article"),
      });
      const byTenant = await app.inject({
        method: "GET",
        url: environmentPath("/entries?tenant=acme"),
      });
      const byStatus = await app.inject({
        method: "GET",
        url: environmentPath("/entries?status=failed"),
      });

      expect((await body(byModel)).seedEntries).toMatchObject({ total: 3 });
      expect((await body(byTenant)).seedEntries).toMatchObject({ total: 1 });
      expect((await body(byStatus)).seedEntries).toMatchObject({ total: 1 });
    });

    it("ignores a status that is not one, rather than narrowing to nothing", async () => {
      await addEntry("article", "created");

      const response = await app.inject({
        method: "GET",
        url: environmentPath("/entries?status=banana"),
      });

      // Passed through unguarded, this matched no row and read as "no entries".
      expect((await body(response)).seedEntries).toMatchObject({ total: 1 });
    });

    it("pages", async () => {
      await addEntry("article", "created");
      await addEntry("author", "created");

      const response = await app.inject({
        method: "GET",
        url: environmentPath("/entries?limit=1&page=2"),
      });

      const listed = (await body(response)).seedEntries as { items: unknown[]; total: number };
      expect(listed.items).toHaveLength(1);
      expect(listed.total).toBe(2);
    });

    it("refuses an environment that belongs to another project", async () => {
      const other = await createTestProject(testContainer, { name: "Other Project" });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.projectId}/environments/${other.environmentId}/entries`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /projects/:id", () => {
    it("updates the fields it was given and leaves the rest", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.projectId}`,
        payload: { name: "Renamed", awsProfile: "work", awsRegion: "eu-central-1" },
      });

      expect(response.statusCode).toBe(200);
      expect((await body(response)).project).toMatchObject({
        name: "Renamed",
        awsProfile: "work",
        awsRegion: "eu-central-1",
        operationsVersion: "6.0.0",
      });
    });

    it("refuses a name another project already has", async () => {
      await createTestProject(testContainer, { name: "Taken" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.projectId}`,
        payload: { name: "Taken" },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it("404s on a project that does not exist", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/projects/no-such-project",
        payload: { name: "Renamed" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /environments/:environmentId", () => {
    it("updates the environment", async () => {
      const response = await app.inject({
        method: "PUT",
        url: environmentPath(""),
        payload: { apiUrl: "https://new.example.com", tenant: "acme" },
      });

      expect(response.statusCode).toBe(200);
      expect((await body(response)).environment).toMatchObject({
        apiUrl: "https://new.example.com",
        tenant: "acme",
      });
    });

    it("refuses an environment that belongs to another project", async () => {
      const other = await createTestProject(testContainer, { name: "Other Project" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.projectId}/environments/${other.environmentId}`,
        payload: { tenant: "acme" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /files", () => {
    it("lists the files stored for an environment", async () => {
      await testContainer.container.resolve(SyncProjectFilesRepository).execute({
        projectId: project.projectId,
        environmentId: project.environmentId,
        tenant: "root",
        files: [
          {
            fileKey: "a.png",
            fileUrl: "https://files.example.com/a.png",
            fileName: "a.png",
            fileType: "image/png",
            fileSize: 10,
          },
        ],
      });

      const response = await app.inject({ method: "GET", url: environmentPath("/files") });

      expect(response.statusCode).toBe(200);
      expect((await body(response)).files).toMatchObject({ total: 1 });
    });

    it("answers an environment with no files with an empty list, not an error", async () => {
      const response = await app.inject({ method: "GET", url: environmentPath("/files") });

      expect(response.statusCode).toBe(200);
      expect((await body(response)).files).toMatchObject({ total: 0 });
    });
  });

  describe("scan roots", () => {
    it("creates, lists and removes one", async () => {
      const directory = mkdtempSync(join(tmpdir(), "scan-root-"));
      const created = await app.inject({
        method: "POST",
        url: "/api/scan-roots",
        payload: { path: directory },
      });
      expect(created.statusCode).toBe(201);
      const id = ((await body(created)).scanRoot as { id: string }).id;

      const listed = await app.inject({ method: "GET", url: "/api/scan-roots" });
      expect((await body(listed)).scanRoots).toMatchObject({ total: 1 });

      const removed = await app.inject({ method: "DELETE", url: `/api/scan-roots/${id}` });
      expect(removed.statusCode).toBe(204);

      const afterRemoval = await app.inject({ method: "GET", url: "/api/scan-roots" });
      expect((await body(afterRemoval)).scanRoots).toMatchObject({ total: 0 });

      rmSync(directory, { recursive: true, force: true });
    });

    it("hands back the existing root rather than adding the same path twice", async () => {
      const directory = mkdtempSync(join(tmpdir(), "scan-root-"));
      const first = await app.inject({
        method: "POST",
        url: "/api/scan-roots",
        payload: { path: directory },
      });
      const second = await app.inject({
        method: "POST",
        url: "/api/scan-roots",
        payload: { path: directory },
      });

      // The user asked for that path to be scanned, and it is.
      expect(((await body(second)).scanRoot as { id: string }).id).toBe(
        ((await body(first)).scanRoot as { id: string }).id,
      );
      const listed = await app.inject({ method: "GET", url: "/api/scan-roots" });
      expect((await body(listed)).scanRoots).toMatchObject({ total: 1 });

      rmSync(directory, { recursive: true, force: true });
    });

    it("refuses a path that is not on disk", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/scan-roots",
        payload: { path: "/definitely/not/here" },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /health", () => {
    it("reports an environment it can reach", async () => {
      testContainer.container.registerInstance(VerifyProjectAccessService, {
        execute: async () => Result.ok(undefined),
      });

      const response = await app.inject({
        method: "POST",
        url: environmentPath("/health?force=true"),
      });

      expect(response.statusCode).toBe(200);
      expect((await body(response)).health).toEqual({ reachable: true, error: null });
    });

    it("reports why it cannot reach one, rather than failing the request", async () => {
      testContainer.container.registerInstance(VerifyProjectAccessService, {
        execute: async () => Result.fail(new GraphQLRequestError("401 Unauthorized", 401)),
      });

      const response = await app.inject({
        method: "POST",
        url: environmentPath("/health?force=true"),
      });

      // "Can I reach this API?" has a truthful answer: no, and this is why.
      expect(response.statusCode).toBe(200);
      expect((await body(response)).health).toMatchObject({ reachable: false });
    });

    it("refuses an environment that belongs to another project", async () => {
      const other = await createTestProject(testContainer, { name: "Other Project" });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.projectId}/environments/${other.environmentId}/health`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
