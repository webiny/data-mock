import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { Result } from "@webiny/stdlib";
import { createCliTestContainer, resolveCommand } from "~/cli/testing/createCliTestContainer.js";
import type { ICliTestContainer } from "~/cli/testing/createCliTestContainer.js";
import { CANCELLED, pick, pickAll } from "~/cli/testing/StubPrompts.js";
import { clearTenants, insertModel, insertTenant } from "~/cli/testing/fixtures.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import { ProjectPersistenceError } from "~/shared/errors.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";
import { SyncModelsService } from "~/shared/node/features/models/sync/abstractions/SyncModelsService.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { FileUploadService } from "~/shared/node/features/files/upload/abstractions/FileUploadService.js";
import { seedTemplates } from "~/shared/node/db/schema.js";

describe("seed command", () => {
  let tc: ICliTestContainer;
  let project: ITestProject;
  let seedCalls: SeedService.Input[];

  afterEach(() => {
    tc.cleanup();
  });

  /** A project with one tenant and one model, and a seed service that records instead of sending. */
  async function ready(answers: unknown[]): Promise<void> {
    tc = createCliTestContainer({ answers });
    project = await createTestProject(tc, { name: "Blog" });
    insertModel(tc, project, "article", "Article");

    seedCalls = [];
    tc.container.registerInstance(SeedService, {
      execute: async (input) => {
        seedCalls.push(input);
        return Result.ok({
          jobId: "seed-1",
          created: input.models.reduce((total, model) => total + model.amount, 0),
          cancelled: false,
          errors: [],
          dryRun: input.dryRun === true,
        });
      },
    });
  }

  it("seeds the chosen model into the chosen tenant", async () => {
    await ready([
      pick("Blog"),
      pick("root (root)"),
      pickAll("Article (article)"),
      "3",
      false,
      false,
    ]);

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls).toHaveLength(1);
    expect(seedCalls[0]).toMatchObject({
      environmentId: project.environmentId,
      tenant: "root",
      models: [{ modelId: "article", amount: 3 }],
      dryRun: false,
    });
    expect(tc.ui.said('Tenant "root": 3 entries created')).toBe(true);
  });

  it("seeds every tenant when All tenants is chosen", async () => {
    tc = createCliTestContainer({
      answers: [pick("Blog"), pick("All tenants"), pickAll("Article (article)"), "1", false, false],
    });
    project = await createTestProject(tc, { name: "Blog" });
    insertTenant(tc, project, "acme", "Acme");
    insertModel(tc, project, "article", "Article");

    seedCalls = [];
    tc.container.registerInstance(SeedService, {
      execute: async (input) => {
        seedCalls.push(input);
        return Result.ok({
          jobId: "seed-1",
          created: 1,
          errors: [],
          cancelled: false,
          dryRun: false,
        });
      },
    });

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls.map((call) => call.tenant).sort()).toEqual(["acme", "root"]);
  });

  it("sends nothing on a dry run, and says so", async () => {
    await ready([
      pick("Blog"),
      pick("root (root)"),
      pickAll("Article (article)"),
      "2",
      true,
      false,
    ]);

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls[0]!.dryRun).toBe(true);
    expect(tc.ui.said("[DRY RUN] ")).toBe(true);
    expect(tc.ui.on("outro")).toEqual(["Dry run complete."]);
  });

  it("keeps going to the next tenant after one fails", async () => {
    tc = createCliTestContainer({
      answers: [pick("Blog"), pick("All tenants"), pickAll("Article (article)"), "1", false, false],
    });
    project = await createTestProject(tc, { name: "Blog" });
    insertTenant(tc, project, "acme", "Acme");
    insertModel(tc, project, "article", "Article");

    const attempted: string[] = [];
    tc.container.registerInstance(SeedService, {
      execute: async (input) => {
        attempted.push(input.tenant);
        return input.tenant === "acme"
          ? Result.fail(new ProjectPersistenceError(new Error("acme is down")))
          : Result.ok({ jobId: "seed-1", created: 1, errors: [], cancelled: false, dryRun: false });
      },
    });

    await resolveCommand(tc, "seed").execute();

    expect(attempted.sort()).toEqual(["acme", "root"]);
    expect(tc.ui.said('Failed for tenant "acme": acme is down')).toBe(true);
  });

  it("reports the first five per-model errors and counts the rest", async () => {
    tc = createCliTestContainer({
      answers: [pick("Blog"), pick("root (root)"), pickAll("Article (article)"), "7", false, false],
    });
    project = await createTestProject(tc, { name: "Blog" });
    insertModel(tc, project, "article", "Article");

    tc.container.registerInstance(SeedService, {
      execute: async () =>
        Result.ok({
          jobId: "seed-1",
          created: 0,
          cancelled: false,
          errors: Array.from({ length: 7 }, (_unused, index) => ({
            modelId: "article",
            message: `error ${index}`,
          })),
          dryRun: false,
        }),
    });

    await resolveCommand(tc, "seed").execute();

    const warnings = tc.ui.on("warn");
    expect(warnings.filter((line) => line.includes("article:"))).toHaveLength(5);
    expect(warnings).toContain("  ...and 2 more errors");
  });

  it("offers to save the configuration as a template, and saves it", async () => {
    await ready([
      pick("Blog"),
      pick("root (root)"),
      pickAll("Article (article)"),
      "4",
      false,
      true,
      "Nightly",
    ]);

    await resolveCommand(tc, "seed").execute();

    const saved = tc.databaseClient.db.select().from(seedTemplates).all();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe("Nightly");
    expect(JSON.parse(saved[0]!.config)).toEqual({
      tenant: "root",
      models: [{ modelId: "article", amount: 4 }],
    });
  });

  it("reports a template whose name is already taken", async () => {
    await ready([
      // First run: no template exists yet, so it goes straight to the model choice.
      pick("Blog"),
      pick("root (root)"),
      pickAll("Article (article)"),
      "4",
      false,
      true,
      "Nightly",
      // Second run: a template exists, so the source is asked for first.
      pick("Blog"),
      pick("root (root)"),
      pick("Configure manually"),
      pickAll("Article (article)"),
      "4",
      false,
      true,
      "Nightly",
    ]);

    const command = resolveCommand(tc, "seed");
    await command.execute();
    await command.execute();

    // Template names are unique per project. Dropped, the second save tells the user nothing and
    // they believe the configuration was kept.
    expect(tc.ui.on("error").join("\n")).toContain("Failed to save template");
    expect(tc.databaseClient.db.select().from(seedTemplates).all()).toHaveLength(1);
  });

  it("reuses a saved template instead of asking for models again", async () => {
    await ready([pick("Blog"), pick("root (root)"), pick("Template: Nightly"), false]);

    tc.databaseClient.db
      .insert(seedTemplates)
      .values({
        id: "template-1",
        projectId: project.projectId,
        name: "Nightly",
        config: JSON.stringify({ tenant: "root", models: [{ modelId: "article", amount: 9 }] }),
        createdAt: Date.now(),
      })
      .run();

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls[0]!.models).toEqual([{ modelId: "article", amount: 9 }]);
    // A run from a template must not offer to save the same template back.
    expect(
      tc.prompts.calls.some((call) => call.message === "Save this configuration as a template?"),
    ).toBe(false);
  });

  it("stops before seeding when no model has been synced", async () => {
    tc = createCliTestContainer({ answers: [pick("Blog"), pick("root (root)")] });
    project = await createTestProject(tc, { name: "Blog" });

    await resolveCommand(tc, "seed").execute();

    expect(tc.ui.on("warn")).toEqual(["No models synced. Run 'yarn cli sync-models' first."]);
  });

  it("offers to sync the tenants when it finds none, and seeds what the sync discovered", async () => {
    tc = createCliTestContainer({
      answers: [
        pick("Blog"),
        true,
        pick("Acme (acme)"),
        pickAll("Article (article)"),
        "2",
        false,
        false,
      ],
    });
    project = await createTestProject(tc, { name: "Blog" });
    clearTenants(tc);
    insertModel(tc, project, "article", "Article");

    // The sync is what puts the tenant there; the seed then has something to choose from.
    tc.container.registerInstance(TenantSyncService, {
      execute: async () => {
        insertTenant(tc, project, "acme", "Acme");
        return Result.ok({
          tenants: [{ tenantId: "acme", name: "Acme" }],
          synced: 1,
          diff: { added: [{ tenantId: "acme", name: "Acme" }], removed: [], unchanged: [] },
          operations: [],
        });
      },
    });

    seedCalls = [];
    tc.container.registerInstance(SeedService, {
      execute: async (input) => {
        seedCalls.push(input);
        return Result.ok({
          jobId: "seed-1",
          created: 2,
          errors: [],
          cancelled: false,
          dryRun: false,
        });
      },
    });

    await resolveCommand(tc, "seed").execute();

    expect(tc.ui.said("Synced 1 tenant(s).")).toBe(true);
    expect(seedCalls[0]!.tenant).toBe("acme");
  });

  it("stops when the tenant sync is declined", async () => {
    tc = createCliTestContainer({ answers: [pick("Blog"), false] });
    project = await createTestProject(tc, { name: "Blog" });
    clearTenants(tc);

    await resolveCommand(tc, "seed").execute();

    expect(tc.ui.on("warn")).toEqual(["No tenants found for this environment."]);
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("stops when the tenant sync finds nothing", async () => {
    tc = createCliTestContainer({ answers: [pick("Blog"), true] });
    project = await createTestProject(tc, { name: "Blog" });
    clearTenants(tc);

    tc.container.registerInstance(TenantSyncService, {
      execute: async () =>
        Result.ok({
          tenants: [],
          synced: 0,
          diff: { added: [], removed: [], unchanged: [] },
          operations: [],
        }),
    });

    await resolveCommand(tc, "seed").execute();

    expect(tc.ui.on("warn").join("\n")).toContain("The sync found no tenants");
  });

  it("says how to add a project when there is none", async () => {
    tc = createCliTestContainer();

    await resolveCommand(tc, "seed").execute();

    expect(tc.ui.on("warn")).toEqual(["No projects configured. Run 'yarn cli add-project' first."]);
  });

  it("sends nothing when the model choice is cancelled", async () => {
    await ready([pick("Blog"), pick("root (root)"), CANCELLED]);

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls).toEqual([]);
    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });

  it("sends nothing when the dry-run question is cancelled", async () => {
    await ready([pick("Blog"), pick("root (root)"), pickAll("Article (article)"), "3", CANCELLED]);

    await resolveCommand(tc, "seed").execute();

    expect(seedCalls).toEqual([]);
  });

  it("requires a positive entry count", async () => {
    await ready([
      pick("Blog"),
      pick("root (root)"),
      pickAll("Article (article)"),
      "3",
      false,
      false,
    ]);

    await resolveCommand(tc, "seed").execute();

    const check = tc.prompts.validators.get("Entries per model")!;
    expect(check("")).toBe("Amount is required");
    expect(check("nope")).toBe("Must be a positive number");
    expect(check("0")).toBe("Must be a positive number");
    expect(check("5")).toBeUndefined();
  });
});

describe("sync-models command", () => {
  let tc: ICliTestContainer;

  afterEach(() => {
    tc.cleanup();
  });

  async function ready(answers: unknown[], outcome: "ok" | "fail"): Promise<ITestProject> {
    tc = createCliTestContainer({ answers });
    const project = await createTestProject(tc, { name: "Blog" });

    tc.container.registerInstance(SyncModelsService, {
      execute: async () =>
        outcome === "ok"
          ? Result.ok({ groups: 2, models: 5, operations: [] })
          : Result.fail(new ProjectPersistenceError(new Error("CMS unreachable"))),
    });

    return project;
  }

  it("syncs the only environment without asking which one", async () => {
    await ready([pick("Blog")], "ok");

    await resolveCommand(tc, "sync-models").execute();

    expect(tc.prompts.calls.map((call) => call.message)).toEqual([
      "Which project to sync models from?",
    ]);
    expect(tc.ui.said("Environment: dev (only one)")).toBe(true);
    expect(tc.ui.said('Synced 2 group(s) and 5 model(s) from "Blog".')).toBe(true);
  });

  it("reports a failed sync on the spinner rather than claiming success", async () => {
    await ready([pick("Blog")], "fail");

    await resolveCommand(tc, "sync-models").execute();

    expect(tc.ui.on("spinner:stop")).toEqual(["Failed: CMS unreachable"]);
    expect(tc.ui.on("outro")).toEqual([]);
  });

  it("says how to add a project when there is none", async () => {
    tc = createCliTestContainer();

    await resolveCommand(tc, "sync-models").execute();

    expect(tc.ui.on("warn")).toEqual(["No projects configured. Run 'yarn cli add-project' first."]);
  });

  it("syncs nothing when the project choice is cancelled", async () => {
    await ready([CANCELLED], "ok");

    await resolveCommand(tc, "sync-models").execute();

    expect(tc.ui.on("cancel")).toEqual(["Cancelled."]);
  });
});

describe("upload-files command", () => {
  let tc: ICliTestContainer;

  afterEach(() => {
    tc.cleanup();
  });

  it("says how to add a project when there is none", async () => {
    tc = createCliTestContainer();

    await resolveCommand(tc, "upload-files").execute();

    expect(tc.ui.on("info")).toEqual(["No projects configured. Run 'yarn cli add-project' first."]);
  });

  it("falls back to the environment's own tenant when none was discovered", async () => {
    tc = createCliTestContainer({ answers: [pick("Blog"), CANCELLED] });
    await createTestProject(tc, { name: "Blog" });
    clearTenants(tc);

    await resolveCommand(tc, "upload-files").execute();

    const tenantPrompt = tc.prompts.calls.find((call) => call.message === "Select tenant")!;
    expect(tenantPrompt.labels).toEqual(["root"]);
  });

  it("offers the discovered tenants when there are some", async () => {
    tc = createCliTestContainer({ answers: [pick("Blog"), CANCELLED] });
    const project = await createTestProject(tc, { name: "Blog" });
    insertTenant(tc, project, "acme", "Acme");

    await resolveCommand(tc, "upload-files").execute();

    const tenantPrompt = tc.prompts.calls.find((call) => call.message === "Select tenant")!;
    expect(tenantPrompt.labels).toEqual(["Acme", "root"]);
  });

  it("uploads every file in the directory and counts the failures", async () => {
    const directory = createTemporaryDirectory(["one.png", "two.png"]);
    tc = createCliTestContainer({ answers: [pick("Blog"), pick("root"), directory.path] });
    const project = await createTestProject(tc, { name: "Blog" });

    const uploaded: string[] = [];
    tc.container.registerInstance(FileUploadService, {
      execute: async (input) => {
        uploaded.push(input.filePath);
        if (input.filePath.endsWith("two.png")) {
          return Result.fail(new ProjectPersistenceError(new Error("upload refused")));
        }
        return Result.ok({
          file: {
            id: "file-1",
            projectId: project.projectId,
            environmentId: project.environmentId,
            tenant: "root",
            fileKey: "one.png",
            fileUrl: "https://files.example.com/one.png",
            fileName: "one.png",
            fileType: "image/png",
            fileSize: 3,
            uploadedAt: Date.now(),
          },
        });
      },
    });

    await resolveCommand(tc, "upload-files").execute();

    expect(uploaded).toHaveLength(2);
    expect(tc.ui.said('Failed to upload "two.png": upload refused')).toBe(true);
    expect(tc.ui.on("spinner:stop")).toEqual(["Uploaded 1 file(s), 1 failed."]);

    directory.cleanup();
  });

  it("stops when the directory holds no file", async () => {
    const directory = createTemporaryDirectory([]);
    tc = createCliTestContainer({ answers: [pick("Blog"), pick("root"), directory.path] });
    await createTestProject(tc, { name: "Blog" });

    await resolveCommand(tc, "upload-files").execute();

    expect(tc.ui.on("warn")).toEqual(["No files found in directory."]);

    directory.cleanup();
  });

  it("refuses a path that is not a directory", async () => {
    const directory = createTemporaryDirectory(["one.png"]);
    tc = createCliTestContainer({ answers: [pick("Blog"), pick("root"), directory.path] });
    await createTestProject(tc, { name: "Blog" });
    tc.container.registerInstance(FileUploadService, {
      execute: async () => Result.fail(new ProjectPersistenceError(new Error("not reached"))),
    });

    await resolveCommand(tc, "upload-files").execute();

    const check = tc.prompts.validators.get("Path to directory containing files to upload")!;
    expect(check("")).toBe("Directory path is required");
    expect(check("/definitely/not/here")).toBe("Directory does not exist");
    expect(check(`${directory.path}/one.png`)).toBe("Path is not a directory");
    expect(check(directory.path)).toBeUndefined();

    directory.cleanup();
  });
});

function createTemporaryDirectory(fileNames: string[]): { path: string; cleanup(): void } {
  const path = mkdtempSync(join(tmpdir(), "cli-upload-"));
  for (const fileName of fileNames) {
    writeFileSync(join(path, fileName), "png");
  }
  return {
    path,
    cleanup() {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
