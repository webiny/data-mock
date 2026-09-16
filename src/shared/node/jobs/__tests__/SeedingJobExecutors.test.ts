import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";
import { CleanupService } from "~/shared/node/features/seeding/cleanup/abstractions/CleanupService.js";
import { ImportEntriesService } from "~/shared/node/features/seeding/import/abstractions/ImportEntriesService.js";
import { PullPicsumImagesService } from "~/shared/node/features/files/picsum/abstractions/PullPicsumImagesService.js";
import { UploadGlobalFilesToProjectService } from "~/shared/node/features/files/pool/abstractions/UploadGlobalFilesToProjectService.js";
import { SeedJobExecutor } from "../executors/abstractions/SeedJobExecutor.js";
import { CleanupJobExecutor } from "../executors/abstractions/CleanupJobExecutor.js";
import { ImportJobExecutor } from "../executors/abstractions/ImportJobExecutor.js";
import { PullPicsumJobExecutor } from "../executors/abstractions/PullPicsumJobExecutor.js";
import { UploadFilesJobExecutor } from "../executors/abstractions/UploadFilesJobExecutor.js";
import { createExecutionContext } from "./executionContext.js";

function persistenceFailure(message: string) {
  return Result.fail(new ProjectPersistenceError(new Error(message)));
}

describe("Seeding job executors", () => {
  let tc: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    tc = createTestContainer();
  });

  afterEach(() => {
    tc.cleanup();
  });

  describe("SeedJobExecutor", () => {
    const seedConfig = {
      tenant: "root",
      batchSize: 10,
      models: [
        { modelId: "article", amount: 3 },
        { modelId: "author", amount: 2 },
      ],
    };

    function stubSeedService(execute: SeedService.Interface["execute"]): SeedJobExecutor.Interface {
      tc.container.registerInstance(SeedService, { execute });
      return tc.container.resolve(SeedJobExecutor);
    }

    it("refuses a job with no config", async () => {
      const executor = stubSeedService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "Seed job requires config",
      );
    });

    it("refuses a job with no environment", async () => {
      const executor = stubSeedService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ config: seedConfig, environmentId: null })),
      ).rejects.toThrow("Seed job requires an environmentId");
    });

    it("forwards the job's environment, signal and progress, and logs the counts", async () => {
      const calls: SeedService.Input[] = [];
      const executor = stubSeedService(async (input) => {
        calls.push(input);
        input.onProgress?.(50, "half");
        return Result.ok({ jobId: "seed-1", created: 5, errors: [], dryRun: false });
      });

      const context = createExecutionContext({ config: seedConfig, environmentId: "env-9" });
      await executor.execute(context);

      expect(calls).toHaveLength(1);
      // The config names no environment; the job's own id is what the entries are written against.
      expect(calls[0]!.environmentId).toBe("env-9");
      expect(calls[0]!.tenant).toBe("root");
      expect(calls[0]!.signal).toBe(context.signal);
      expect(context.progress).toEqual([{ percent: 50, label: "half" }]);
      expect(context.logs).toEqual([
        "Starting seed for project env-9",
        "Models: article(3), author(2)",
        "Completed: 5 created, 0 errors",
      ]);
    });

    it("logs every per-model error the seed reported", async () => {
      const executor = stubSeedService(async () =>
        Result.ok({
          jobId: "seed-1",
          created: 1,
          errors: [
            { modelId: "article", message: "validation failed" },
            { modelId: "author", message: "rate limited" },
          ],
          dryRun: false,
        }),
      );

      const context = createExecutionContext({ config: seedConfig });
      await executor.execute(context);

      expect(context.logs).toContain("Completed: 1 created, 2 errors");
      expect(context.logs).toContain("  Error (article): validation failed");
      expect(context.logs).toContain("  Error (author): rate limited");
    });

    it("fails the job when the seed service fails", async () => {
      const executor = stubSeedService(async () => persistenceFailure("database is locked"));

      await expect(
        executor.execute(createExecutionContext({ config: seedConfig })),
      ).rejects.toThrow("database is locked");
    });
  });

  describe("CleanupJobExecutor", () => {
    function stubCleanupService(
      execute: CleanupService.Interface["execute"],
    ): CleanupJobExecutor.Interface {
      tc.container.registerInstance(CleanupService, { execute });
      return tc.container.resolve(CleanupJobExecutor);
    }

    it("refuses a job with no environment", async () => {
      const executor = stubCleanupService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ environmentId: null })),
      ).rejects.toThrow("Cleanup job requires an environmentId");
    });

    it("runs with no config at all, and reports what it deleted", async () => {
      const calls: CleanupService.Input[] = [];
      const executor = stubCleanupService(async (input) => {
        calls.push(input);
        input.onProgress?.(100, "done");
        return Result.ok({ deleted: 12, errors: 1, models: [] });
      });

      const context = createExecutionContext({ environmentId: "env-3" });
      await executor.execute(context);

      expect(calls[0]).toMatchObject({ environmentId: "env-3" });
      // A cleanup with no job named clears the environment, not one seed run — so no jobId key.
      expect(calls[0]!.jobId).toBeUndefined();
      expect(context.progress).toEqual([{ percent: 100, label: "done" }]);
      expect(context.logs).toEqual([
        "Cleaning up entries for project env-3",
        "Deleted 12 entries, 1 errors.",
      ]);
    });

    it("narrows to one seed run when the config names a job", async () => {
      const calls: CleanupService.Input[] = [];
      const executor = stubCleanupService(async (input) => {
        calls.push(input);
        return Result.ok({ deleted: 2, errors: 0, models: [] });
      });

      await executor.execute(createExecutionContext({ config: { jobId: "seed-77" } }));

      expect(calls[0]!.jobId).toBe("seed-77");
    });

    it("fails the job when the cleanup service fails", async () => {
      const executor = stubCleanupService(async () => persistenceFailure("cleanup exploded"));

      await expect(executor.execute(createExecutionContext())).rejects.toThrow("cleanup exploded");
    });
  });

  describe("ImportJobExecutor", () => {
    const importConfig = { tenant: "root", models: ["article", "author"] };

    function stubImportService(
      execute: ImportEntriesService.Interface["execute"],
    ): ImportJobExecutor.Interface {
      tc.container.registerInstance(ImportEntriesService, { execute });
      return tc.container.resolve(ImportJobExecutor);
    }

    it("refuses a job with no config", async () => {
      const executor = stubImportService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "Import job requires config",
      );
    });

    it("refuses a job with no environment", async () => {
      const executor = stubImportService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ config: importConfig, environmentId: null })),
      ).rejects.toThrow("Import job requires an environmentId");
    });

    it("imports the configured models into the job's environment", async () => {
      const calls: ImportEntriesService.Input[] = [];
      const executor = stubImportService(async (input) => {
        calls.push(input);
        input.onProgress?.(25, "importing");
        return Result.ok({ imported: 7, models: [] });
      });

      const context = createExecutionContext({ config: importConfig, environmentId: "env-4" });
      await executor.execute(context);

      expect(calls[0]).toMatchObject({
        environmentId: "env-4",
        tenant: "root",
        models: ["article", "author"],
      });
      expect(context.progress).toEqual([{ percent: 25, label: "importing" }]);
      expect(context.logs).toEqual([
        "Importing entries for project env-4, models: article, author",
        "Imported 7 entries.",
      ]);
    });

    it("fails the job when the import service fails", async () => {
      const executor = stubImportService(async () => persistenceFailure("import exploded"));

      await expect(
        executor.execute(createExecutionContext({ config: importConfig })),
      ).rejects.toThrow("import exploded");
    });
  });

  describe("PullPicsumJobExecutor", () => {
    function stubPicsumService(
      execute: PullPicsumImagesService.Interface["execute"],
    ): PullPicsumJobExecutor.Interface {
      tc.container.registerInstance(PullPicsumImagesService, { execute });
      return tc.container.resolve(PullPicsumJobExecutor);
    }

    it("pulls a default count when the job carries no config", async () => {
      const calls: PullPicsumImagesService.Input[] = [];
      const executor = stubPicsumService(async (input) => {
        calls.push(input);
        return Result.ok({ downloaded: 10, directory: "/tmp/pool", files: [] });
      });

      // pull-picsum is global — neither id, and nothing to read a count off.
      const context = createExecutionContext({ projectId: null, environmentId: null });
      await executor.execute(context);

      expect(calls[0]!.count).toBe(10);
      expect(calls[0]!.width).toBeUndefined();
      expect(calls[0]!.height).toBeUndefined();
      expect(context.logs).toEqual(["Pulling 10 picsum image(s)...", "Downloaded 10 image(s)."]);
    });

    it("forwards the dimensions only when the config names them", async () => {
      const calls: PullPicsumImagesService.Input[] = [];
      const executor = stubPicsumService(async (input) => {
        calls.push(input);
        input.onProgress?.(100, "done");
        return Result.ok({ downloaded: 3, directory: "/tmp/pool", files: [] });
      });

      const context = createExecutionContext({
        config: { count: 3, width: 800, height: 600 },
      });
      await executor.execute(context);

      expect(calls[0]).toMatchObject({ count: 3, width: 800, height: 600 });
      expect(context.progress).toEqual([{ percent: 100, label: "done" }]);
    });

    it("fails the job when the picsum service fails", async () => {
      const executor = stubPicsumService(async () => persistenceFailure("picsum is down"));

      await expect(executor.execute(createExecutionContext())).rejects.toThrow("picsum is down");
    });
  });

  describe("UploadFilesJobExecutor", () => {
    const uploadConfig = { tenant: "root", fileNames: ["a.png", "b.png"] };

    function stubUploadService(
      execute: UploadGlobalFilesToProjectService.Interface["execute"],
    ): UploadFilesJobExecutor.Interface {
      tc.container.registerInstance(UploadGlobalFilesToProjectService, { execute });
      return tc.container.resolve(UploadFilesJobExecutor);
    }

    it("refuses a job with no config", async () => {
      const executor = stubUploadService(async () => {
        throw new Error("should not be called");
      });

      await expect(executor.execute(createExecutionContext())).rejects.toThrow(
        "Upload files job requires config",
      );
    });

    it("refuses a job with no environment", async () => {
      const executor = stubUploadService(async () => {
        throw new Error("should not be called");
      });

      await expect(
        executor.execute(createExecutionContext({ config: uploadConfig, environmentId: null })),
      ).rejects.toThrow("Upload files job requires an environmentId");
    });

    it("uploads the named files into the job's environment", async () => {
      const calls: UploadGlobalFilesToProjectService.Input[] = [];
      const executor = stubUploadService(async (input) => {
        calls.push(input);
        input.onProgress?.(50, "uploading");
        return Result.ok({ uploaded: 2, failures: [], files: [] });
      });

      const context = createExecutionContext({ config: uploadConfig, environmentId: "env-5" });
      await executor.execute(context);

      expect(calls[0]).toMatchObject({
        environmentId: "env-5",
        tenant: "root",
        fileNames: ["a.png", "b.png"],
      });
      expect(context.progress).toEqual([{ percent: 50, label: "uploading" }]);
      expect(context.logs).toEqual([
        "Uploading global images to environment env-5",
        "Uploaded 2 file(s).",
      ]);
    });

    it("names every file it could not upload, and counts them", async () => {
      const executor = stubUploadService(async () =>
        Result.ok({
          uploaded: 1,
          failures: [
            { fileName: "b.png", error: "413 Payload Too Large" },
            { fileName: "c.png", error: "network reset" },
          ],
          files: [],
        }),
      );

      const context = createExecutionContext({ config: uploadConfig });
      await executor.execute(context);

      // A bare "Uploaded 1 file(s)." over two failures reads as a clean run.
      expect(context.logs).toContain('  Failed "b.png": 413 Payload Too Large');
      expect(context.logs).toContain('  Failed "c.png": network reset');
      expect(context.logs).toContain("Uploaded 1 file(s), 2 failed.");
    });

    it("fails the job when the upload service fails", async () => {
      const executor = stubUploadService(async () => persistenceFailure("upload exploded"));

      await expect(
        executor.execute(createExecutionContext({ config: uploadConfig })),
      ).rejects.toThrow("upload exploded");
    });
  });
});
