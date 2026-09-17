import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "@webiny/di";
import { ConsoleLoggerFeature } from "@webiny/stdlib";
import { GeneratorFeature } from "../feature.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import { PatternValidator } from "../validators/PatternValidator.js";
import { GreaterThanOrEqualDateValidator } from "../validators/GreaterThanOrEqualDateValidator.js";
import { LesserThanOrEqualDateValidator } from "../validators/LesserThanOrEqualDateValidator.js";
import { MinimumLengthValidator } from "../validators/MinimumLengthValidator.js";
import { BaseMultiGenerator } from "../fields/BaseGenerator.js";
import { BooleanGenerator } from "../fields/BooleanGenerator.js";
import type { IGeneratorGenerateParams } from "../types.js";
import type { ApiCmsModelField } from "~/shared/types.js";

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

describe("text pattern presets", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  async function generate(target: ApiCmsModelField): Promise<string> {
    const registry = container.resolve(GeneratorRegistry);
    return (await registry.getGenerator({ field: target }).generate(target)) as string;
  }

  function patternField(settings: Record<string, unknown>): ApiCmsModelField {
    return field({ validation: [{ name: "pattern", message: "bad", settings }] });
  }

  it.each([
    ["email", /@/],
    ["url", /^https?:\/\//],
  ])("generates a value matching the %s preset", async (preset, shape) => {
    expect(await generate(patternField({ preset }))).toMatch(shape);
  });

  it.each(["uppercase", "uppercasespace"])("generates %s text", async (preset) => {
    const value = await generate(patternField({ preset }));

    expect(value).toBe(value.toUpperCase());
  });

  it.each(["lowercase", "lowercasespace"])("generates %s text", async (preset) => {
    const value = await generate(patternField({ preset }));

    expect(value).toBe(value.toLowerCase());
  });

  it.each([
    ["an email regex", "^[a-z]+@[a-z]+\\.[a-z]+$", /@/],
    ["a url regex", "^https?://.+$", /^https?:\/\//],
    ["a date regex", "^\\d{4}-\\d{2}-\\d{2}$", /^\d{4}-\d{2}-\d{2}$/],
    ["a phone regex", "^[0-9()\\-\\s]+$", /^\+1\d{10}$/],
    ["a slug regex", "[a-z0-9]+", /^[a-z0-9-]+$/],
  ])("reads %s and generates something that fits", async (_label, regex, shape) => {
    expect(await generate(patternField({ preset: "custom", regex }))).toMatch(shape);
  });

  it("falls back to plain text for a custom regex it cannot read", async () => {
    const value = await generate(patternField({ preset: "custom", regex: "^\\p{Emoji}+$" }));

    // Better a value the CMS may reject than no value at all.
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("falls back to plain text for a custom preset with no regex", async () => {
    expect(typeof (await generate(patternField({ preset: "custom" })))).toBe("string");
  });

  it("falls back to plain text for a preset it does not know", async () => {
    expect(typeof (await generate(patternField({ preset: "morse-code" })))).toBe("string");
  });
});

describe("predefined values", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  async function generate(target: ApiCmsModelField): Promise<unknown> {
    const registry = container.resolve(GeneratorRegistry);
    return registry.getGenerator({ field: target }).generate(target);
  }

  it("picks a number field's predefined value", async () => {
    const target = field({
      type: "number",
      predefinedValues: {
        enabled: true,
        values: [{ label: "Ten", value: "10", selected: false }],
      },
    });

    expect(await generate(target)).toBe(10);
  });

  it("picks a predefined value for a number list too", async () => {
    const target = field({
      type: "number",
      list: true,
      predefinedValues: {
        enabled: true,
        values: [{ label: "Ten", value: "10", selected: false }],
      },
    });

    expect(await generate(target)).toEqual([10]);
  });

  it("picks one of several predefined values", async () => {
    const target = field({
      type: "number",
      predefinedValues: {
        enabled: true,
        values: [
          { label: "One", value: "1", selected: false },
          { label: "Two", value: "2", selected: false },
        ],
      },
    });

    for (let run = 0; run < 20; run++) {
      expect([1, 2]).toContain(await generate(target));
    }
  });
});

describe("dynamic zone", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  async function generate(target: ApiCmsModelField): Promise<unknown> {
    const registry = container.resolve(GeneratorRegistry);
    return registry.getGenerator({ field: target }).generate(target);
  }

  it("generates the fields of a template", async () => {
    const target = field({
      type: "dynamicZone",
      fieldId: "content",
      storageId: "content",
      settings: {
        templates: [
          {
            id: "t1",
            gqlTypeName: "Hero",
            fields: [field({ fieldId: "heading", storageId: "heading" })],
          },
        ],
      },
    });

    const value = (await generate(target)) as Record<string, Record<string, unknown>>;

    // Keyed by the template's GraphQL type name, which is how Webiny expects a zone value.
    expect(value.Hero).toHaveProperty("heading");
  });

  it("generates nothing for a zone with no templates", async () => {
    const target = field({ type: "dynamicZone", settings: { templates: [] } });

    expect(await generate(target)).toBeNull();
  });

  it("generates nothing for a zone with no templates setting at all", async () => {
    const target = field({ type: "dynamicZone", settings: {} });

    expect(await generate(target)).toBeNull();
  });
});

describe("validator list and default paths", () => {
  it("PatternValidator returns the default for a list, never a rule", () => {
    const validator = new PatternValidator(
      field({
        listValidation: [{ name: "pattern", message: "bad", settings: { preset: "email" } }],
      }),
    );

    // A list's pattern rule applies to each item, which the item's own field already carries.
    expect(validator.getListValue()).toBeUndefined();
    expect(validator.getListValue({ preset: "url", regex: "" })).toEqual({
      preset: "url",
      regex: "",
    });
  });

  it("PatternValidator falls back to the default when there is no rule", () => {
    expect(new PatternValidator(field()).getValue({ preset: "url", regex: "" })).toEqual({
      preset: "url",
      regex: "",
    });
  });

  it.each([
    ["GreaterThanOrEqualDateValidator", GreaterThanOrEqualDateValidator, "dateGte"],
    ["LesserThanOrEqualDateValidator", LesserThanOrEqualDateValidator, "dateLte"],
  ])("%s reads its list rule", (_label, Validator, rule) => {
    const validator = new Validator(
      field({
        listValidation: [{ name: rule, message: "bad", settings: { value: "2024-01-01" } }],
      }),
    );

    expect(validator.getListValue()).toBe("2024-01-01");
  });

  it.each([
    ["GreaterThanOrEqualDateValidator", GreaterThanOrEqualDateValidator],
    ["LesserThanOrEqualDateValidator", LesserThanOrEqualDateValidator],
  ])("%s falls back to the default for a list", (_label, Validator) => {
    expect(new Validator(field()).getListValue("2020-01-01")).toBe("2020-01-01");
    expect(new Validator(field()).getListValue()).toBeUndefined();
  });

  it("ignores a rule whose shape is not a validation at all", () => {
    // Written by hand, or by an older build. It must read as absent rather than throw.
    const malformed = field({
      validation: [{ name: "minLength" } as never],
      listValidation: [{ nope: true } as never],
    });
    const validator = new MinimumLengthValidator(malformed);

    expect(validator.getValue(5)).toBe(5);
    expect(validator.getListValue(5)).toBe(5);
  });

  it("ignores a rule of a name the validator does not own", () => {
    const validator = new MinimumLengthValidator(
      field({
        validation: [{ name: "maxLength", message: "bad", settings: { value: 9 } }],
        listValidation: [{ name: "maxLength", message: "bad", settings: { value: 9 } }],
      }),
    );

    expect(validator.getValue(2)).toBe(2);
    expect(validator.getListValue(2)).toBe(2);
  });
});

describe("list generators", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  it("makes a list of the length the list validators ask for", async () => {
    const target = field({
      type: "number",
      list: true,
      listValidation: [
        { name: "minLength", message: "too few", settings: { value: 4 } },
        { name: "maxLength", message: "too many", settings: { value: 4 } },
      ],
    });

    const registry = container.resolve(GeneratorRegistry);
    const value = (await registry.getGenerator({ field: target }).generate(target)) as number[];

    expect(value).toHaveLength(4);
  });

  it("makes an empty list when none is asked for", async () => {
    const target = field({
      type: "number",
      list: true,
      listValidation: [
        { name: "minLength", message: "too few", settings: { value: 0 } },
        { name: "maxLength", message: "too many", settings: { value: 0 } },
      ],
    });

    const registry = container.resolve(GeneratorRegistry);

    expect(await registry.getGenerator({ field: target }).generate(target)).toEqual([]);
  });
});

describe("registry internals a generator reaches", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  /** A generator registered only for this test, so the paths only generators use are reachable. */
  class ProbeGenerator extends BaseMultiGenerator<unknown> {
    public type = "probe";

    public async generate(params: IGeneratorGenerateParams): Promise<unknown[]> {
      const { field: probeField } = params;
      const mode = probeField.settings?.["mode"] as string;

      if (mode === "unregistered") {
        // Asking for a generator class nobody registered.
        this.getGenerator(class Nowhere extends BooleanGenerator {});
        return [];
      }

      if (mode === "range") {
        // `iterate` given a range rather than a count.
        return this.iterate({ min: 3, max: 3 }, async () => "x");
      }

      // `iterate` dropping what a generator answered with null.
      return this.iterate(4, async (index) => (index % 2 === 0 ? "kept" : null));
    }
  }

  function probeField(mode: string): ApiCmsModelField {
    return field({ type: "probe", list: true, settings: { mode } });
  }

  function registryWithProbe(): GeneratorRegistry.Interface {
    const registry = container.resolve(GeneratorRegistry);
    registry.registerGenerator(ProbeGenerator);
    return registry;
  }

  it("refuses to hand a generator a class nobody registered", async () => {
    const target = probeField("unregistered");

    await expect(
      registryWithProbe().getGenerator({ field: target }).generate(target),
    ).rejects.toThrow('Generator for type "Nowhere" not found!');
  });

  it("iterates a range as well as a count", async () => {
    const target = probeField("range");

    expect(await registryWithProbe().getGenerator({ field: target }).generate(target)).toEqual([
      "x",
      "x",
      "x",
    ]);
  });

  it("drops the entries a generator answered with null", async () => {
    const target = probeField("drop");

    // A field the generator could not produce must not leave a hole in the list.
    expect(await registryWithProbe().getGenerator({ field: target }).generate(target)).toEqual([
      "kept",
      "kept",
    ]);
  });
});

describe("dynamic zone template selection", () => {
  it("starts from the template the field names as current", async () => {
    const container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);

    const target = field({
      type: "dynamicZone",
      settings: {
        current: 1,
        templates: [
          { id: "t0", gqlTypeName: "First", fields: [] },
          { id: "t1", gqlTypeName: "Second", fields: [] },
        ],
      },
    });

    const value = (await container
      .resolve(GeneratorRegistry)
      .getGenerator({ field: target })
      .generate(target)) as Record<string, unknown>;

    expect(Object.keys(value)).toEqual(["Second"]);
  });
});

describe("fields whose settings the CMS left empty", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);
  });

  async function generate(target: ApiCmsModelField): Promise<unknown> {
    return container.resolve(GeneratorRegistry).getGenerator({ field: target }).generate(target);
  }

  it("generates a datetime for a field carrying no settings", async () => {
    // `settings` is nullable on the model field, so a date field can arrive without one.
    const value = (await generate(field({ type: "datetime", settings: null }))) as string;

    expect(Number.isNaN(Date.parse(value))).toBe(false);
  });

  it("generates nothing for a reference field that names no model", async () => {
    const withoutSettings = await generate(
      field({ type: "ref", settings: null, fieldId: "author", storageId: "author" }),
    );
    const withoutModels = await generate(
      field({ type: "ref", settings: {}, fieldId: "author", storageId: "author" }),
    );

    expect(withoutSettings).toBeNull();
    expect(withoutModels).toBeNull();
  });
});

describe("dynamic zone with a current index out of range", () => {
  it("still picks a template when current points past the last one", async () => {
    const container = new Container();
    ConsoleLoggerFeature.register(container);
    GeneratorFeature.register(container);

    const target = field({
      type: "dynamicZone",
      settings: {
        current: 9,
        templates: [{ id: "t0", gqlTypeName: "First", fields: [] }],
      },
    });

    // Unclamped this reached faker as min 9, max 0, which throws.
    const value = (await container
      .resolve(GeneratorRegistry)
      .getGenerator({ field: target })
      .generate(target)) as Record<string, unknown>;

    expect(Object.keys(value)).toEqual(["First"]);
  });
});
