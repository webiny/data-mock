import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";
import type { ITestProject } from "~/shared/node/testing/createTestProject.js";
import { SyncProjectModelsRepository } from "../sync/abstractions/SyncProjectModelsRepository.js";
import { ListProjectModelsRepository } from "../list/abstractions/ListProjectModelsRepository.js";
import { projectModels } from "~/shared/node/db/schema.js";
import type { ApiCmsModelField } from "~/shared/types.js";

function textField(overrides: Partial<ApiCmsModelField> = {}): ApiCmsModelField {
  return {
    id: "f1",
    fieldId: "title",
    storageId: "title",
    type: "text",
    list: false,
    settings: {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
    ...overrides,
  };
}

function model(
  modelId: string,
  fields: ApiCmsModelField[] = [textField()],
): SyncProjectModelsRepository.Input["models"][number] {
  return {
    groupSlug: "content",
    modelId,
    name: modelId,
    singularApiName: modelId,
    pluralApiName: `${modelId}s`,
    fields,
  };
}

describe("SyncProjectModelsRepository", () => {
  let testContainer: ReturnType<typeof createTestContainer>;
  let project: ITestProject;

  beforeEach(async () => {
    testContainer = createTestContainer();
    project = await createTestProject(testContainer, { name: "Models Project" });
  });

  afterEach(() => {
    testContainer.cleanup();
  });

  function repository(): SyncProjectModelsRepository.Interface {
    return testContainer.container.resolve(SyncProjectModelsRepository);
  }

  async function sync(models: ReturnType<typeof model>[]) {
    return repository().execute({
      projectId: project.projectId,
      environmentId: project.environmentId,
      tenant: "root",
      models,
    });
  }

  async function stored() {
    const listed = await testContainer.container
      .resolve(ListProjectModelsRepository)
      .execute({ environmentId: project.environmentId, tenant: "root" });
    return listed.isOk() ? listed.value : [];
  }

  it("stores the models it was given", async () => {
    const result = await sync([model("article"), model("author")]);

    expect(result.isOk()).toBe(true);
    expect((await stored()).map((entry) => entry.modelId).sort()).toEqual(["article", "author"]);
  });

  it("replaces what was there rather than adding to it", async () => {
    await sync([model("article"), model("author")]);
    await sync([model("article")]);

    // A sync is a picture of the CMS now, not a running total.
    expect((await stored()).map((entry) => entry.modelId)).toEqual(["article"]);
  });

  it("keeps another environment's models out of it", async () => {
    const other = await createTestProject(testContainer, { name: "Other Project" });
    await sync([model("article")]);

    await repository().execute({
      projectId: other.projectId,
      environmentId: other.environmentId,
      tenant: "root",
      models: [model("product")],
    });

    expect((await stored()).map((entry) => entry.modelId)).toEqual(["article"]);
  });

  it("round-trips the field definitions through storage", async () => {
    await sync([model("article", [textField({ fieldId: "headline", storageId: "headline" })])]);

    const fields = (await stored())[0]?.fields ?? [];
    expect(fields).toHaveLength(1);
    expect(fields[0]?.fieldId).toBe("headline");
  });

  it("gives a pattern validator the empty flags the generator expects", async () => {
    await sync([
      model("article", [
        textField({
          validation: [{ name: "pattern", message: "bad", settings: { preset: "email" } }],
        }),
      ]),
    ]);

    // A null or absent `flags` reaches `new RegExp(pattern, flags)` as undefined and throws.
    const validation = (await stored())[0]?.fields[0]?.validation ?? [];
    expect(validation[0]?.settings?.flags).toBe("");
  });

  it("sanitizes the validators nested inside an object field", async () => {
    await sync([
      model("article", [
        textField({
          type: "object",
          settings: {
            fields: [
              textField({
                validation: [{ name: "pattern", message: "bad", settings: { preset: "email" } }],
              }),
            ],
          },
        }),
      ]),
    ]);

    const nested = (await stored())[0]?.fields[0]?.settings?.["fields"] as ApiCmsModelField[];
    expect(nested[0]?.validation?.[0]?.settings?.["flags"]).toBe("");
  });

  it("sanitizes the validators inside a dynamic zone template", async () => {
    await sync([
      model("article", [
        textField({
          type: "dynamicZone",
          settings: {
            templates: [
              {
                fields: [
                  textField({
                    validation: [
                      { name: "pattern", message: "bad", settings: { preset: "email" } },
                    ],
                  }),
                ],
              },
            ],
          },
        }),
      ]),
    ]);

    const templates = (await stored())[0]?.fields[0]?.settings?.["templates"] as Array<{
      fields: ApiCmsModelField[];
    }>;
    expect(templates[0]?.fields[0]?.validation?.[0]?.settings?.["flags"]).toBe("");
  });

  it("leaves a validator that already has flags alone", async () => {
    await sync([
      model("article", [
        textField({
          validation: [{ name: "pattern", message: "bad", settings: { flags: "i" } }],
        }),
      ]),
    ]);

    expect((await stored())[0]?.fields[0]?.validation?.[0]?.settings?.["flags"]).toBe("i");
  });

  it("records the plugin flag", async () => {
    await sync([{ ...model("article"), plugin: true }, model("author")]);

    const byId = new Map((await stored()).map((entry) => [entry.modelId, entry]));
    expect(byId.get("article")?.plugin).toBe(true);
    expect(byId.get("author")?.plugin).toBe(false);
  });

  it("clears the models when the CMS reports none", async () => {
    await sync([model("article")]);

    const result = await sync([]);

    expect(result.isOk()).toBe(true);
    expect(await stored()).toHaveLength(0);
  });

  it("keeps the previous models when the write cannot be finished", async () => {
    await sync([model("article"), model("author")]);

    /**
     * Two models with the same id violate the unique index, so the second insert throws part-way
     * through. Without a transaction the delete has already emptied the environment, and a sync
     * that failed would have destroyed the inventory it was refreshing.
     */
    const result = await sync([model("product"), model("product")]);

    expect(result.isFail()).toBe(true);
    expect((await stored()).map((entry) => entry.modelId).sort()).toEqual(["article", "author"]);
  });

  it("writes both ids, so a read can narrow on either", async () => {
    await sync([model("article")]);

    const row = testContainer.databaseClient.db
      .select()
      .from(projectModels)
      .where(eq(projectModels.modelId, "article"))
      .get();

    expect(row?.projectId).toBe(project.projectId);
    expect(row?.environmentId).toBe(project.environmentId);
  });
});
