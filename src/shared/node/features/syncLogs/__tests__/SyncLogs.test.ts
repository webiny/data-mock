import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { CreateSyncLogRepository } from "../create/abstractions/CreateSyncLogRepository.js";
import { ListSyncLogsRepository } from "../list/abstractions/ListSyncLogsRepository.js";
import { DeleteSyncLogRepository } from "../delete/abstractions/DeleteSyncLogRepository.js";

describe("SyncLogs Feature", () => {
  let tc: ReturnType<typeof createTestContainer>;
  let projectId: string;

  beforeEach(async () => {
    tc = createTestContainer();
    const createProject = tc.container.resolve(CreateProjectUseCase);
    const result = await createProject.execute({
      name: "SyncLog Project",
      apiUrl: "https://api.example.com",
      apiToken: "token",
      tenant: "root",
    });
    if (result.isFail()) {
      throw new Error("Failed to create project");
    }
    projectId = result.value.id;
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("CreateSyncLogRepository", () => {
    it("should create a sync log entry", async () => {
      const repo = tc.container.resolve(CreateSyncLogRepository);
      const result = await repo.execute({
        projectId,
        type: "tenants",
        status: "success",
        message: "Synced 3 tenants",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.id).toBeDefined();
        expect(result.value.projectId).toBe(projectId);
        expect(result.value.type).toBe("tenants");
        expect(result.value.status).toBe("success");
        expect(result.value.message).toBe("Synced 3 tenants");
        expect(result.value.createdAt).toBeGreaterThan(0);
      }
    });

    it("should store request and response data", async () => {
      const repo = tc.container.resolve(CreateSyncLogRepository);
      const requestData = { query: "{ listTenants { data { id } } }" };
      const responseData = { data: { listTenants: { data: [{ id: "t1" }] } } };

      const result = await repo.execute({
        projectId,
        type: "models",
        status: "success",
        message: "Synced models",
        request: requestData,
        response: responseData,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.request).toEqual(requestData);
        expect(result.value.response).toEqual(responseData);
      }
    });

    it("should create an error log", async () => {
      const repo = tc.container.resolve(CreateSyncLogRepository);
      const result = await repo.execute({
        projectId,
        type: "tenants",
        status: "error",
        message: "Network timeout",
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("error");
        expect(result.value.message).toBe("Network timeout");
      }
    });
  });

  describe("ListSyncLogsRepository", () => {
    it("should return empty when no logs exist", async () => {
      const repo = tc.container.resolve(ListSyncLogsRepository);
      const result = await repo.execute({ projectId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.logs).toEqual([]);
      }
    });

    it("should list all logs for a project", async () => {
      const createRepo = tc.container.resolve(CreateSyncLogRepository);
      const listRepo = tc.container.resolve(ListSyncLogsRepository);

      await createRepo.execute({
        projectId,
        type: "tenants",
        status: "success",
        message: "Synced tenants",
      });
      await createRepo.execute({
        projectId,
        type: "models",
        status: "error",
        message: "Model sync failed",
      });

      const result = await listRepo.execute({ projectId });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.logs).toHaveLength(2);
      }
    });
  });

  describe("DeleteSyncLogRepository", () => {
    it("should delete a sync log entry", async () => {
      const createRepo = tc.container.resolve(CreateSyncLogRepository);
      const deleteRepo = tc.container.resolve(DeleteSyncLogRepository);
      const listRepo = tc.container.resolve(ListSyncLogsRepository);

      const createResult = await createRepo.execute({
        projectId,
        type: "tenants",
        status: "success",
        message: "Done",
      });
      expect(createResult.isOk()).toBe(true);
      if (!createResult.isOk()) {
        return;
      }

      const deleteResult = await deleteRepo.execute({ id: createResult.value.id });
      expect(deleteResult.isOk()).toBe(true);

      const listResult = await listRepo.execute({ projectId });
      expect(listResult.isOk()).toBe(true);
      if (listResult.isOk()) {
        expect(listResult.value.logs).toHaveLength(0);
      }
    });
  });
});
