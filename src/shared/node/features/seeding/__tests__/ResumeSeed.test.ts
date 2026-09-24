import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import { CreateSeedJobRepository } from "../create/abstractions/CreateSeedJobRepository.js";
import { UpdateSeedJobRepository } from "../update/abstractions/UpdateSeedJobRepository.js";
import { CreateSeedEntryRepository } from "../entries/abstractions/CreateSeedEntryRepository.js";
import { ResumeSeedService } from "../resume/abstractions/ResumeSeedService.js";
import type { SeedEntryStatus, SeedJobConfig, SeedJobStatus } from "~/shared/types.js";

describe("ResumeSeedService", () => {
  let testContainer: ReturnType<typeof createTestContainer>;
  let project: ITestProject;

  beforeEach(async () => {
    testContainer = createTestContainer();
    project = await createTestProject(testContainer, { name: "Resume Project" });
  });

  afterEach(() => {
    testContainer.cleanup();
  });

  /** A seed run in a terminal state, with whatever it managed to create. */
  async function seedRun(
    config: SeedJobConfig,
    status: SeedJobStatus,
    created: Array<{ modelId: string; count: number; status?: SeedEntryStatus }>,
  ): Promise<string> {
    const job = await testContainer.container.resolve(CreateSeedJobRepository).execute({
      projectId: project.projectId,
      environmentId: project.environmentId,
      config,
    });
    if (job.isFail()) {
      throw new Error("Could not create the seed job");
    }

    const entries = testContainer.container.resolve(CreateSeedEntryRepository);
    for (const model of created) {
      for (let index = 0; index < model.count; index++) {
        await entries.execute({
          jobId: job.value.id,
          projectId: project.projectId,
          environmentId: project.environmentId,
          tenant: "acme",
          modelId: model.modelId,
          entryId: `${model.modelId}-${index}`,
          entryData: {},
          requestData: null,
          responseData: null,
          httpStatus: 200,
          status: model.status ?? "created",
          error: null,
        });
      }
    }

    await testContainer.container
      .resolve(UpdateSeedJobRepository)
      .execute({ id: job.value.id, status });

    return job.value.id;
  }

  function service(): ResumeSeedService.Interface {
    return testContainer.container.resolve(ResumeSeedService);
  }

  it("asks only for what the run did not create", async () => {
    const seedJobId = await seedRun(
      {
        tenant: "acme",
        batchSize: 5,
        models: [
          { modelId: "article", amount: 100 },
          { modelId: "author", amount: 10 },
        ],
      },
      "cancelled",
      [{ modelId: "article", count: 47 }],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) {
      return;
    }
    expect(result.value.models).toEqual([
      { modelId: "article", amount: 53 },
      { modelId: "author", amount: 10 },
    ]);
    expect(result.value.tenant).toBe("acme");
    expect(result.value.batchSize).toBe(5);
    expect(result.value.alreadyCreated).toBe(47);
  });

  it("leaves out a model the run finished", async () => {
    const seedJobId = await seedRun(
      {
        tenant: "acme",
        models: [
          { modelId: "article", amount: 5 },
          { modelId: "author", amount: 3 },
        ],
      },
      "failed",
      [
        { modelId: "article", count: 5 },
        { modelId: "author", count: 1 },
      ],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isOk() && result.value.models).toEqual([{ modelId: "author", amount: 2 }]);
  });

  it("counts only the entries that were actually created", async () => {
    const seedJobId = await seedRun(
      { tenant: "acme", models: [{ modelId: "article", amount: 10 }] },
      "cancelled",
      [
        { modelId: "article", count: 3 },
        // A failed send left a row behind; it is not an entry the CMS has.
        { modelId: "article", count: 2, status: "failed" },
      ],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isOk() && result.value.models).toEqual([{ modelId: "article", amount: 7 }]);
  });

  it("keeps the publish options the run was started with", async () => {
    const seedJobId = await seedRun(
      {
        tenant: "acme",
        models: [{ modelId: "article", amount: 4 }],
        publishStrategy: "random",
        publishPercent: 30,
        includeUnpublish: true,
      },
      "cancelled",
      [],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isOk() && result.value).toMatchObject({
      publishStrategy: "random",
      publishPercent: 30,
      includeUnpublish: true,
    });
  });

  it("recovers the tenant from the entries when the run did not record one", async () => {
    // Rows written before the tenant was stored on the config.
    const seedJobId = await seedRun({ models: [{ modelId: "article", amount: 4 }] }, "cancelled", [
      { modelId: "article", count: 1 },
    ]);

    const result = await service().execute({ seedJobId });

    expect(result.isOk() && result.value.tenant).toBe("acme");
  });

  it("refuses when there is no way to know which tenant was being seeded", async () => {
    const seedJobId = await seedRun(
      { models: [{ modelId: "article", amount: 4 }] },
      "cancelled",
      [],
    );

    const result = await service().execute({ seedJobId });

    // Guessing would seed the wrong tenant.
    expect(result.isFail() && result.error.message).toContain("does not record which tenant");
  });

  it("refuses a run that finished on purpose", async () => {
    const seedJobId = await seedRun(
      { tenant: "acme", models: [{ modelId: "article", amount: 4 }] },
      "completed",
      [{ modelId: "article", count: 1 }],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isFail() && result.error.message).toContain("nothing to resume");
  });

  it("refuses a run that created everything it was asked for", async () => {
    const seedJobId = await seedRun(
      { tenant: "acme", models: [{ modelId: "article", amount: 2 }] },
      "cancelled",
      [{ modelId: "article", count: 2 }],
    );

    const result = await service().execute({ seedJobId });

    expect(result.isFail() && result.error.message).toContain("created everything");
  });

  it("refuses a run that does not exist", async () => {
    const result = await service().execute({ seedJobId: "no-such-run" });

    expect(result.isFail() && result.error.message).toContain("not found");
  });
});
