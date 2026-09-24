import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";
import type { OperationLog, SyncLog } from "~/shared/types.js";
import type { SyncPreviewResponse } from "~/shared/responses/sync.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { SyncSystemService } from "~/shared/node/features/webinyCli/sync/abstractions/SyncSystemService.js";
import { SyncPreviewService } from "~/shared/node/features/webinyCli/sync/preview/abstractions/SyncPreviewService.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { SyncModelsJobExecutor } from "../executors/abstractions/SyncModelsJobExecutor.js";
import { SyncTenantsJobExecutor } from "../executors/abstractions/SyncTenantsJobExecutor.js";
import { SyncSystemJobExecutor } from "../executors/abstractions/SyncSystemJobExecutor.js";
import { SyncPreviewJobExecutor } from "../executors/abstractions/SyncPreviewJobExecutor.js";
import { createExecutionContext } from "./executionContext.js";

/** Records what each executor writes to the sync log, without a database behind it. */
function recordingSyncLogs() {
  const calls: CreateSyncLogRepository.Input[] = [];
  const repository: CreateSyncLogRepository.Interface = {
    execute: async (input) => {
      calls.push(input);
      const log: SyncLog = {
        id: `log-${calls.length}`,
        projectId: input.projectId,
        environmentId: input.environmentId,
        type: input.type,
        status: input.status,
        message: input.message,
        request: input.request ?? null,
        response: input.response ?? null,
        createdAt: Date.now(),
      };
      return Result.ok(log);
    },
  };
  return { calls, repository };
}

function operationLog(name: string): OperationLog {
  return {
    name,
    url: "https://api.example.com/cms/manage/en-US",
    query: `query ${name} { __typename }`,
    httpStatus: 200,
    response: { data: {} },
  };
}

function preview(projectId: string, projectName: string): SyncPreviewResponse {
  return {
    projectId,
    projectName,
    backend: "local",
    hasChanges: true,
    project: [],
    environments: [],
    messages: [],
  };
}

describe("Sync job executors", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("SyncModelsJobExecutor", () => {
    let syncLogs: ReturnType<typeof recordingSyncLogs>;

    beforeEach(() => {
      syncLogs = recordingSyncLogs();
      tc.container.registerInstance(CreateSyncLogRepository, syncLogs.repository);
    });

    function stubSyncModelsService(
      execute: SyncModelsService.Interface["execute"],
    ): SyncModelsJobExecutor.Interface {
      tc.container.registerInstance(SyncModelsService, { execute });
      return tc.container.resolve(SyncModelsJobExecutor);
    }

    it("refuses a job with no environment", async () => {
      const executor = stubSyncModelsService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ environmentId: null })),
      ).rejects.toThrow("Pull models job requires an environmentId");
    });

    it("refuses a job with no project", async () => {
      const executor = stubSyncModelsService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext({ projectId: null }))).rejects.toThrow(
        "Sync job requires a projectId",
      );
    });

    it("writes a success sync log carrying the operations, and logs the counts", async () => {
      const executor = stubSyncModelsService(async (input) => {
        input.onProgress?.(40, "reading models");
        return Result.ok({
          groups: 2,
          models: 5,
          operations: [operationLog("ListModels")],
        });
      });

      const context = createExecutionContext({ projectId: "project-2", environmentId: "env-2" });
      await executor.execute(context);

      expect(syncLogs.calls).toHaveLength(1);
      expect(syncLogs.calls[0]).toMatchObject({
        projectId: "project-2",
        environmentId: "env-2",
        type: "models",
        status: "success",
        message: "Synced 5 model(s)",
      });
      // The operations are the request half of the log; the summary must not carry them twice.
      expect(syncLogs.calls[0]!.request).toEqual([operationLog("ListModels")]);
      expect(syncLogs.calls[0]!.response).toEqual({ groups: 2, models: 5 });
      expect(context.progress).toEqual([{ percent: 40, label: "reading models" }]);
      expect(context.logs).toEqual([
        "Syncing models for environment env-2",
        "Synced 5 model(s) and 2 group(s).",
      ]);
    });

    it("writes an error sync log and then fails the job", async () => {
      const executor = stubSyncModelsService(async () =>
        Result.fail(new ProjectPersistenceError(new Error("models unreachable"))),
      );

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "models unreachable",
      );

      expect(syncLogs.calls).toHaveLength(1);
      expect(syncLogs.calls[0]).toMatchObject({
        type: "models",
        status: "error",
        message: "models unreachable",
      });
    });
  });

  describe("SyncTenantsJobExecutor", () => {
    let syncLogs: ReturnType<typeof recordingSyncLogs>;

    beforeEach(() => {
      syncLogs = recordingSyncLogs();
      tc.container.registerInstance(CreateSyncLogRepository, syncLogs.repository);
    });

    function stubTenantSyncService(
      execute: TenantSyncService.Interface["execute"],
    ): SyncTenantsJobExecutor.Interface {
      tc.container.registerInstance(TenantSyncService, { execute });
      return tc.container.resolve(SyncTenantsJobExecutor);
    }

    it("refuses a job with no environment", async () => {
      const executor = stubTenantSyncService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ environmentId: null })),
      ).rejects.toThrow("Pull tenants job requires an environmentId");
    });

    it("refuses a job with no project", async () => {
      const executor = stubTenantSyncService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext({ projectId: null }))).rejects.toThrow(
        "Sync job requires a projectId",
      );
    });

    it("writes a success sync log carrying the operations, and logs the count", async () => {
      const executor = stubTenantSyncService(async (input) => {
        input.onProgress?.(80, "storing tenants");
        return Result.ok({
          tenants: [{ tenantId: "root", name: "Root" }],
          synced: 1,
          diff: { added: [], removed: [], unchanged: [{ tenantId: "root", name: "Root" }] },
          operations: [operationLog("ListTenants")],
        });
      });

      const context = createExecutionContext({ projectId: "project-3", environmentId: "env-3" });
      await executor.execute(context);

      expect(syncLogs.calls[0]).toMatchObject({
        projectId: "project-3",
        environmentId: "env-3",
        type: "tenants",
        status: "success",
        message: "Synced 1 tenant(s)",
      });
      expect(syncLogs.calls[0]!.request).toEqual([operationLog("ListTenants")]);
      expect(context.progress).toEqual([{ percent: 80, label: "storing tenants" }]);
      expect(context.logs).toEqual([
        "Syncing tenants for environment env-3",
        "Synced 1 tenant(s).",
      ]);
    });

    it("writes an error sync log and then fails the job", async () => {
      const executor = stubTenantSyncService(async () =>
        Result.fail(new ProjectPersistenceError(new Error("tenants unreachable"))),
      );

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "tenants unreachable",
      );

      expect(syncLogs.calls[0]).toMatchObject({ type: "tenants", status: "error" });
    });
  });

  describe("SyncSystemJobExecutor", () => {
    function stubSyncSystemService(
      execute: SyncSystemService.Interface["execute"],
    ): SyncSystemJobExecutor.Interface {
      tc.container.registerInstance(SyncSystemService, { execute });
      return tc.container.resolve(SyncSystemJobExecutor);
    }

    function summary(overrides: Partial<SyncSystemService.Output> = {}): SyncSystemService.Output {
      return {
        status: "success",
        versionMajor: 6,
        webinyVersion: "6.4.9",
        environmentsFound: 2,
        environmentsDeployed: 1,
        stacksRead: 3,
        stacksUnknown: 0,
        messages: ["Read dev", "Read prod"],
        ...overrides,
      };
    }

    it("refuses a job with no project", async () => {
      const executor = stubSyncSystemService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext({ projectId: null }))).rejects.toThrow(
        "Sync system job requires a projectId",
      );
    });

    it("runs project-scoped, replays the service's own messages and reports the version", async () => {
      const calls: SyncSystemService.Input[] = [];
      const executor = stubSyncSystemService(async (input) => {
        calls.push(input);
        input.onProgress?.(60, "reading stacks");
        return Result.ok(summary());
      });

      // Environment-less on purpose: syncing is what discovers the environments.
      const context = createExecutionContext({ projectId: "project-7", environmentId: null });
      await executor.execute(context);

      expect(calls[0]!.projectId).toBe("project-7");
      expect(context.progress).toEqual([{ percent: 60, label: "reading stacks" }]);
      expect(context.logs).toEqual([
        "Read dev",
        "Read prod",
        "Version: 6.4.9 (v6)",
        "Environments: 2 found, 1 deployed.",
      ]);
    });

    it("names a workspace root rather than printing a null version", async () => {
      const executor = stubSyncSystemService(async () =>
        Result.ok(summary({ webinyVersion: null, versionMajor: null })),
      );

      const context = createExecutionContext();
      await executor.execute(context);

      expect(context.logs).toContain("Version: workspace root (built from source)");
    });

    it("calls out stacks it could not read, so a stale inventory is not read as a wrong one", async () => {
      const executor = stubSyncSystemService(async () => Result.ok(summary({ stacksUnknown: 2 })));

      const context = createExecutionContext();
      await executor.execute(context);

      expect(context.logs).toContain(
        "2 stack(s) could not be read; their stored output was left unchanged.",
      );
    });

    it("says nothing about unreadable stacks when every stack was read", async () => {
      const executor = stubSyncSystemService(async () => Result.ok(summary()));

      const context = createExecutionContext();
      await executor.execute(context);

      expect(context.logs.some((line) => line.includes("could not be read"))).toBe(false);
    });

    it("fails the job when the sync service fails", async () => {
      const executor = stubSyncSystemService(async () =>
        Result.fail(new ValidationError("not a Webiny project")),
      );

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "not a Webiny project",
      );
    });
  });

  describe("SyncPreviewJobExecutor", () => {
    function stubSyncPreviewService(
      execute: SyncPreviewService.Interface["execute"],
    ): SyncPreviewJobExecutor.Interface {
      tc.container.registerInstance(SyncPreviewService, { execute });
      return tc.container.resolve(SyncPreviewJobExecutor);
    }

    it("refuses a job whose config names no project", async () => {
      const executor = stubSyncPreviewService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ config: { projectIds: [] } })),
      ).rejects.toThrow();
    });

    it("leaves one preview per project on the job, and reports progress across the batch", async () => {
      const executor = stubSyncPreviewService(async (input) =>
        Result.ok(preview(input.projectId, `Project ${input.projectId}`)),
      );

      // sync-preview is global: it writes nothing, so it carries neither id.
      const context = createExecutionContext({
        projectId: null,
        environmentId: null,
        config: { projectIds: ["a", "b"] },
      });
      await executor.execute(context);

      expect(context.result).toEqual({
        previews: [preview("a", "Project a"), preview("b", "Project b")],
        failures: [],
      });
      expect(context.progress).toEqual([
        { percent: 50, label: "Read 1 of 2 project(s)" },
        { percent: 100, label: "Read 2 of 2 project(s)" },
      ]);
    });

    it("records a project it could not read and keeps going", async () => {
      const executor = stubSyncPreviewService(async (input) =>
        input.projectId === "broken"
          ? Result.fail(new ValidationError("no checkout on disk"))
          : Result.ok(preview(input.projectId, "Fine")),
      );

      const context = createExecutionContext({
        projectId: null,
        config: { projectIds: ["broken", "fine"] },
      });
      await executor.execute(context);

      expect(context.result).toEqual({
        previews: [preview("fine", "Fine")],
        failures: [{ projectId: "broken", error: "no checkout on disk" }],
      });
      expect(context.logs).toEqual(["broken: no checkout on disk"]);
    });

    it("reads nothing once the job is cancelled", async () => {
      let calls = 0;
      const executor = stubSyncPreviewService(async (input) => {
        calls += 1;
        return Result.ok(preview(input.projectId, "Fine"));
      });

      const context = createExecutionContext({ config: { projectIds: ["a", "b"] } });
      context.abort();
      await executor.execute(context);

      expect(calls).toBe(0);
      expect(context.result).toEqual({ previews: [], failures: [] });
    });
  });
});
