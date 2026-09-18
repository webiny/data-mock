import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { Logger } from "@webiny/stdlib";
import { GeneratorFeature } from "../feature.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import { createEntryVariables, createSingleEntryVariables } from "../createEntryVariables.js";
import { MinimumLengthValidator } from "../validators/MinimumLengthValidator.js";
import { MaximumLengthValidator } from "../validators/MaximumLengthValidator.js";
import type { IGenerator, IRegistryGenerator } from "../types.js";
import type { ApiCmsModelField, ProjectFile } from "~/shared/types.js";

function field(overrides: Partial<ApiCmsModelField> = {}): ApiCmsModelField {
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

/** A registry whose every generator throws, for the paths that only a failure reaches. */
function failingRegistry(thrown: unknown): GeneratorRegistry.Interface {
  return {
    registerGenerator: () => {},
    registerValidator: () => {},
    getGenerator<T extends IGenerator<unknown>>(): IRegistryGenerator<T> {
      return {
        generate: () => Promise.reject(thrown) as ReturnType<T["generate"]>,
      };
    },
  };
}

describe("createEntryVariables", () => {
  let container: Container;
  let errors: string[];
  let logger: Logger.Interface;

  beforeEach(() => {
    container = new Container();
    errors = [];

    const recordingLogger: Logger.Interface = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      fatal: () => {},
      error: (message: string) => {
        errors.push(message);
      },
      child: () => recordingLogger,
    };
    logger = recordingLogger;
    container.registerInstance(Logger, recordingLogger);
    GeneratorFeature.register(container);
  });

  function registry(): GeneratorRegistry.Interface {
    return container.resolve(GeneratorRegistry);
  }

  it("produces a value for every field, keyed by fieldId", async () => {
    const entry = await createSingleEntryVariables(registry(), {
      fields: [field(), field({ id: "f2", fieldId: "count", storageId: "count", type: "number" })],
    });

    expect(Object.keys(entry.values).sort()).toEqual(["count", "title"]);
    expect(typeof entry.values.title).toBe("string");
    expect(typeof entry.values.count).toBe("number");
  });

  it("produces an empty entry for a model with no fields", async () => {
    const entry = await createSingleEntryVariables(registry(), { fields: [] });

    expect(entry.values).toEqual({});
  });

  it("makes as many entries as asked for", async () => {
    const entries = await createEntryVariables(registry(), logger, { fields: [field()] }, 5);

    expect(entries).toHaveLength(5);
  });

  it("makes none when asked for none", async () => {
    expect(await createEntryVariables(registry(), logger, { fields: [field()] }, 0)).toEqual([]);
  });

  it("passes the available references through to the generator", async () => {
    const refField = field({
      type: "ref",
      fieldId: "author",
      storageId: "author",
      settings: { models: [{ modelId: "author" }] },
    });
    const availableRefs = new Map([["author", ["author-1"]]]);

    const entries = await createEntryVariables(registry(), logger, { fields: [refField] }, 3, {
      availableRefs,
    });

    // Without the refs reaching the generator every ref field would come back empty.
    for (const entry of entries) {
      expect(entry.values.author).toEqual({ id: "author-1", modelId: "author" });
    }
  });

  it("passes the file pool through to the generator", async () => {
    const fileField = field({ type: "file", fieldId: "cover", storageId: "cover" });
    const filePool: ProjectFile[] = [
      {
        id: "file-1",
        projectId: "project-1",
        environmentId: "env-1",
        tenant: "root",
        fileKey: "a.png",
        fileUrl: "https://files.example.com/a.png",
        fileName: "a.png",
        fileType: "image/png",
        fileSize: 10,
        uploadedAt: 1,
      },
    ];

    const entries = await createEntryVariables(registry(), logger, { fields: [fileField] }, 2, {
      filePool,
    });

    for (const entry of entries) {
      expect(entry.values.cover).toBe("https://files.example.com/a.png");
    }
  });

  it("reports the failure and rethrows when a generator throws", async () => {
    const throwingRegistry = failingRegistry(new Error("generator exploded"));

    await expect(
      createEntryVariables(throwingRegistry, logger, { fields: [field()] }, 1),
    ).rejects.toThrow("generator exploded");

    // Rethrown so the seed reports the entry as failed; logged so the reason is not only in a
    // Result nobody prints.
    expect(errors).toContain("generator exploded");
  });

  it("reports a thrown non-Error too", async () => {
    const throwingRegistry = failingRegistry("just a string");

    await expect(
      createEntryVariables(throwingRegistry, logger, { fields: [field()] }, 1),
    ).rejects.toBeDefined();
    expect(errors).toContain("just a string");
  });
});

describe("length validators", () => {
  function lengthField(
    validation: ApiCmsModelField["validation"],
    listValidation: ApiCmsModelField["listValidation"],
  ): ApiCmsModelField {
    return field({ validation, listValidation });
  }

  it.each([
    ["MinimumLengthValidator", MinimumLengthValidator, "minLength"],
    ["MaximumLengthValidator", MaximumLengthValidator, "maxLength"],
  ])("%s reads the list rule from listValidation", (_label, Validator, rule) => {
    const validator = new Validator(
      lengthField([], [{ name: rule, message: "bad", settings: { value: 7 } }]),
    );

    expect(validator.getListValue(1)).toBe(7);
  });

  it.each([
    ["MinimumLengthValidator", MinimumLengthValidator],
    ["MaximumLengthValidator", MaximumLengthValidator],
  ])("%s falls back when there is no list rule", (_label, Validator) => {
    expect(new Validator(lengthField([], [])).getListValue(3)).toBe(3);
  });

  it.each([
    ["MinimumLengthValidator", MinimumLengthValidator, "minLength"],
    ["MaximumLengthValidator", MaximumLengthValidator, "maxLength"],
  ])("%s falls back when the list rule carries no value", (_label, Validator, rule) => {
    const validator = new Validator(
      lengthField([], [{ name: rule, message: "bad", settings: {} }]),
    );

    expect(validator.getListValue(3)).toBe(3);
  });

  it.each([
    ["MinimumLengthValidator", MinimumLengthValidator, "minLength"],
    ["MaximumLengthValidator", MaximumLengthValidator, "maxLength"],
  ])("%s falls back when the value is not a number", (_label, Validator, rule) => {
    const single = new Validator(
      lengthField([{ name: rule, message: "bad", settings: { value: "not a number" } }], []),
    );
    const list = new Validator(
      lengthField([], [{ name: rule, message: "bad", settings: { value: "not a number" } }]),
    );

    // A bad value reaching faker as NaN throws; the default is the safe answer.
    expect(single.getValue(4)).toBe(4);
    expect(list.getListValue(4)).toBe(4);
  });

  it.each([
    ["MinimumLengthValidator", MinimumLengthValidator, "minLength"],
    ["MaximumLengthValidator", MaximumLengthValidator, "maxLength"],
  ])("%s reads a numeric string", (_label, Validator, rule) => {
    const validator = new Validator(
      lengthField([{ name: rule, message: "bad", settings: { value: "12" } }], []),
    );

    expect(validator.getValue(1)).toBe(12);
  });
});
