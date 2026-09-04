import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { ApiFeature } from "../feature.js";
import { createServer } from "../server.js";
import { registerApiRoutes } from "../routes/index.js";
import type { FastifyInstance } from "fastify";

describe("Sync Logs API routes", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let app: FastifyInstance;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    ApiFeature.register(tc.container);
    app = await createServer(tc.container, [registerApiRoutes]);

    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "Log Test Project",
      apiUrl: "https://api.example.com",
      apiToken: "token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error("Failed to create project");
    }
    projectId = result.value.id;
  });

  afterEach(async () => {
    await app.close();
    tc.cleanup();
  });

  it("should list all log types including upload-file and pull-files", async () => {
    const createLog = tc.container.resolve(CreateSyncLogRepository);

    await createLog.execute({
      projectId,
      type: "tenants",
      status: "success",
      message: "Pulled tenants",
    });
    await createLog.execute({
      projectId,
      type: "upload-file",
      status: "success",
      message: 'Uploaded "photo.jpg"',
      request: { fileName: "photo.jpg" },
      response: { src: "https://cdn.example.com/photo.jpg" },
    });
    await createLog.execute({
      projectId,
      type: "pull-files",
      status: "success",
      message: "Pulled 5 files",
      response: { synced: 5 },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/sync-logs`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.syncLogs.items).toHaveLength(3);

    const types = body.syncLogs.items.map((l: { type: string }) => l.type);
    expect(types).toContain("tenants");
    expect(types).toContain("upload-file");
    expect(types).toContain("pull-files");
  });

  it("should return upload-file logs with request and response data", async () => {
    const createLog = tc.container.resolve(CreateSyncLogRepository);

    await createLog.execute({
      projectId,
      type: "upload-file",
      status: "success",
      message: 'Uploaded "image.png"',
      request: { fileName: "image.png", fileType: "image/png", fileSize: 12000 },
      response: { src: "https://cdn.example.com/image.png", key: "abc/image.png", id: "fm-123" },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/sync-logs`,
    });

    expect(response.statusCode).toBe(200);
    const log = response.json().syncLogs.items[0];
    expect(log.type).toBe("upload-file");
    expect(log.request.fileName).toBe("image.png");
    expect(log.response.src).toBe("https://cdn.example.com/image.png");
  });

  it("should delete a sync log entry", async () => {
    const createLog = tc.container.resolve(CreateSyncLogRepository);
    const result = await createLog.execute({
      projectId,
      type: "upload-file",
      status: "success",
      message: "Test log",
    });
    if (result.isFail()) {
      throw new Error("Failed to create log");
    }

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/sync-logs/${result.value.id}`,
    });
    expect(deleteResponse.statusCode).toBe(204);

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/sync-logs`,
    });
    expect(listResponse.json().syncLogs.items).toHaveLength(0);
  });
});
