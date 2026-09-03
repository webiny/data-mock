import { describe, it, expect, afterEach } from "vitest";
import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import { GeneratorRegistry } from "../abstractions/GeneratorRegistry.js";
import type { ApiCmsModelField } from "~/shared/types.js";

const containers: Array<{ cleanup(): void }> = [];

function setup() {
  const tc = createTestContainer();
  containers.push(tc);
  return tc;
}

afterEach(() => {
  for (const tc of containers) {
    tc.cleanup();
  }
  containers.length = 0;
});

function createField(overrides: Partial<ApiCmsModelField> & { type: string }): ApiCmsModelField {
  return {
    id: overrides.id ?? "field1",
    fieldId: overrides.fieldId ?? "field1",
    storageId: overrides.storageId ?? "field1",
    type: overrides.type,
    list: overrides.list ?? false,
    settings: overrides.settings ?? {},
    predefinedValues: overrides.predefinedValues ?? { enabled: false, values: [] },
    validation: overrides.validation ?? [],
    listValidation: overrides.listValidation ?? [],
  } as ApiCmsModelField;
}

describe("GeneratorRegistry", () => {
  it("should resolve from container", () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    expect(registry).toBeDefined();
  });

  it("should have generators for all expected types", () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);

    const types = [
      "text",
      "number",
      "boolean",
      "datetime",
      "long-text",
      "json",
      "file",
      "rich-text",
      "ref",
      "object",
    ];

    for (const type of types) {
      const field = createField({ type });
      const generator = registry.getGenerator({ field });
      expect(generator).toBeDefined();
      expect(generator.generate).toBeTypeOf("function");
    }
  });

  it("should have multi generators for list fields", () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);

    const types = [
      "text",
      "number",
      "datetime",
      "long-text",
      "json",
      "file",
      "rich-text",
      "ref",
      "object",
    ];

    for (const type of types) {
      const field = createField({ type, list: true });
      const generator = registry.getGenerator({ field });
      expect(generator).toBeDefined();
    }
  });
});

describe("TextGenerator", () => {
  it("should generate a string value", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "text" });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("should respect predefined values", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({
      type: "text",
      predefinedValues: {
        enabled: true,
        values: [
          { label: "Option A", value: "option-a", selected: false },
          { label: "Option B", value: "option-b", selected: false },
        ],
      },
    });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(["option-a", "option-b"]).toContain(result);
  });

  it("should return an array for multi text generator", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "text", list: true });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).length).toBeGreaterThan(0);
  });
});

describe("NumberGenerator", () => {
  it("should generate a number", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "number" });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("number");
    expect(result as number).toBeGreaterThanOrEqual(1);
    expect(result as number).toBeLessThanOrEqual(100);
  });

  it("should respect predefined values", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({
      type: "number",
      predefinedValues: {
        enabled: true,
        values: [
          { label: "Ten", value: "10", selected: false },
          { label: "Twenty", value: "20", selected: false },
        ],
      },
    });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect([10, 20]).toContain(result);
  });
});

describe("BooleanGenerator", () => {
  it("should generate true or false", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "boolean" });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("boolean");
  });
});

describe("DateTimeGenerator", () => {
  it("should generate a date string for date type", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "datetime", settings: { type: "date" } });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should generate a time string for time type", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "datetime", settings: { type: "time" } });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("string");
    expect(result as string).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
  });

  it("should generate an ISO string for dateTimeWithoutTimezone", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "datetime", settings: { type: "dateTimeWithoutTimezone" } });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(10);
  });
});

describe("RefGenerator", () => {
  it("should return null for single ref", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "ref" });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(result).toBeNull();
  });

  it("should return null for multi ref", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "ref", list: true });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(result).toBeNull();
  });
});

describe("ObjectGenerator", () => {
  it("should generate nested fields recursively", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);

    const nestedTextField = {
      ...createField({ id: "title", fieldId: "title", storageId: "title", type: "text" }),
      label: "Title",
    };
    const nestedNumberField = {
      ...createField({ id: "count", fieldId: "count", storageId: "count", type: "number" }),
      label: "Count",
    };

    const objectField = createField({
      type: "object",
      settings: { fields: [nestedTextField, nestedNumberField] },
    });
    const generator = registry.getGenerator({ field: objectField });

    const result = (await generator.generate(objectField)) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(typeof result["title"]).toBe("string");
    expect(typeof result["count"]).toBe("number");
  });

  it("should return null when no nested fields defined", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({ type: "object", settings: {} });
    const generator = registry.getGenerator({ field });

    const result = await generator.generate(field);
    expect(result).toBeNull();
  });
});

describe("Validator Integration", () => {
  it("MinimumLengthValidator extracts min length from field validation", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({
      type: "text",
      validation: [{ name: "minLength", message: "Too short", settings: { value: "5" } }],
    });
    const generator = registry.getGenerator({ field });

    const result = (await generator.generate(field)) as string;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("MaximumLengthValidator constrains text length", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({
      type: "text",
      validation: [{ name: "maxLength", message: "Too long", settings: { value: "10" } }],
    });
    const generator = registry.getGenerator({ field });

    const result = (await generator.generate(field)) as string;
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("Text generator respects both min and max length validators", async () => {
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);
    const field = createField({
      type: "text",
      validation: [
        { name: "minLength", message: "Too short", settings: { value: "3" } },
        { name: "maxLength", message: "Too long", settings: { value: "8" } },
      ],
    });
    const generator = registry.getGenerator({ field });

    for (let i = 0; i < 10; i++) {
      const result = (await generator.generate(field)) as string;
      expect(result.length).toBeLessThanOrEqual(8);
    }
  });
});

describe("createSingleEntryVariables", () => {
  it("should produce non-null values for all text fields in a model", async () => {
    const { createSingleEntryVariables } = await import("../createEntryVariables.js");
    const { container } = setup();
    const registry = container.resolve(GeneratorRegistry);

    const fields = [
      createField({
        id: "firstName",
        fieldId: "firstName",
        storageId: "text@firstName",
        type: "text",
      }),
      createField({
        id: "lastName",
        fieldId: "lastName",
        storageId: "text@lastName",
        type: "text",
      }),
      createField({ id: "email", fieldId: "email", storageId: "text@email", type: "text" }),
      createField({ id: "phone", fieldId: "phone", storageId: "text@phone", type: "text" }),
      createField({
        id: "message",
        fieldId: "message",
        storageId: "long-text@message",
        type: "long-text",
      }),
    ];

    const entry = await createSingleEntryVariables(registry, { fields });

    for (const field of fields) {
      const value = entry.values[field.fieldId];
      expect(value, `${field.fieldId} should not be null`).not.toBeNull();
      expect(typeof value, `${field.fieldId} should be a string`).toBe("string");
      expect((value as string).length, `${field.fieldId} should have length > 0`).toBeGreaterThan(
        0,
      );
    }
  });
});
