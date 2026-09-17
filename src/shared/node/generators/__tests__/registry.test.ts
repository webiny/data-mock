import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { Logger } from "@webiny/stdlib";
import { GeneratorFeature } from "../feature.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import type { ApiCmsModelField } from "~/shared/types.js";

function createField(overrides: Partial<ApiCmsModelField> = {}): ApiCmsModelField {
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

describe("GeneratorRegistry", () => {
  let container: Container;
  let errors: string[];

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
    container.registerInstance(Logger, recordingLogger);
    GeneratorFeature.register(container);
  });

  function registry(): GeneratorRegistry.Interface {
    return container.resolve(GeneratorRegistry);
  }

  it("picks the generator that matches the field type", async () => {
    const value = await registry().getGenerator({ field: createField() }).generate(createField());

    expect(typeof value).toBe("string");
  });

  it("picks a different generator for the list form of the same type", async () => {
    const field = createField({ list: true });

    const value = await registry().getGenerator({ field }).generate(field);

    expect(Array.isArray(value)).toBe(true);
  });

  it("reads the type before the colon, so a versioned type still resolves", async () => {
    // Webiny writes some field types as `text:something`.
    const field = createField({ type: "text:custom" });

    const value = await registry().getGenerator({ field }).generate(field);

    expect(typeof value).toBe("string");
  });

  it("generates null and says so, rather than throwing, for a type it does not know", async () => {
    const field = createField({ type: "quantum-flux" });

    const value = await registry().getGenerator({ field }).generate(field);

    // One unknown field must not take the whole entry down.
    expect(value).toBeNull();
    expect(errors.join("\n")).toContain('Generator for type "quantum-flux"');
  });

  it("says whether it was the list form it could not find", async () => {
    await registry()
      .getGenerator({ field: createField({ type: "quantum-flux", list: true }) })
      .generate(createField({ type: "quantum-flux", list: true }));

    expect(errors.join("\n")).toContain('multiple values "true"');
  });

  it("hands each generator the validators of the field being generated", async () => {
    const field = createField({
      type: "long-text",
      validation: [{ name: "minLength", message: "too short", settings: { value: 200 } }],
    });

    const value = (await registry().getGenerator({ field }).generate(field)) as string;

    // The minimum is read through getValidator; a registry that ignored it would return a short
    // string from the generator's own default.
    expect(value.length).toBeGreaterThan(50);
  });

  it("registers a generator for every field type the CMS can send", async () => {
    const types = [
      "text",
      "long-text",
      "rich-text",
      "number",
      "boolean",
      "datetime",
      "json",
      "file",
      "object",
      "ref",
      "dynamicZone",
    ];

    for (const type of types) {
      const field = createField({ type });
      await registry().getGenerator({ field }).generate(field);
    }

    // Any missing one logs; none should.
    expect(errors).toEqual([]);
  });

  it("registers the list form of every type that has one", async () => {
    // Boolean has no list form: Webiny cannot express a boolean[] field, so there is nothing to
    // generate for one.
    const types = ["text", "long-text", "rich-text", "number", "datetime", "json"];

    for (const type of types) {
      const field = createField({ type, list: true });
      const value = await registry().getGenerator({ field }).generate(field);
      expect(Array.isArray(value)).toBe(true);
    }

    expect(errors).toEqual([]);
  });
});
