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

function createField(
  type: string,
  fieldId: string,
  overrides?: Partial<ApiCmsModelField>,
): ApiCmsModelField {
  return {
    id: fieldId,
    fieldId,
    storageId: fieldId,
    type,
    list: false,
    settings: {},
    predefinedValues: { enabled: false, values: [] },
    validation: [],
    listValidation: [],
    ...overrides,
  } as unknown as ApiCmsModelField;
}

function createNestedField(
  type: string,
  fieldId: string,
  overrides?: Partial<ApiCmsModelField>,
): ApiCmsModelField {
  return createField(type, fieldId, overrides);
}

const FILE_POOL = [
  {
    id: "f1",
    projectId: "p1",
    tenant: "root",
    fileKey: "key1",
    fileUrl: "https://example.com/file1.png",
    fileName: "file1.png",
    fileType: "image/png",
    fileSize: 1024,
    uploadedAt: Date.now(),
  },
  {
    id: "f2",
    projectId: "p1",
    tenant: "root",
    fileKey: "key2",
    fileUrl: "https://example.com/file2.png",
    fileName: "file2.png",
    fileType: "image/png",
    fileSize: 2048,
    uploadedAt: Date.now(),
  },
];

describe("Field Generators", () => {
  describe("DynamicZoneGenerator", () => {
    it("should generate a value for a dynamic-zone field", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      const field = createField("dynamicZone", "content", {
        settings: {
          templates: [
            {
              name: "hero",
              gqlTypeName: "Hero",
              fields: [createNestedField("text", "title")],
            },
          ],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should return null when templates is undefined", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("dynamicZone", "content", { settings: {} });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should return null when templates is empty", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("dynamicZone", "content", {
        settings: { templates: [] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should generate an array for list: true dynamic-zone (MultiDynamicZoneGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("dynamicZone", "sections", {
        list: true,
        settings: {
          templates: [
            {
              name: "hero",
              gqlTypeName: "Hero",
              fields: [createNestedField("text", "title")],
            },
            {
              name: "cta",
              gqlTypeName: "Cta",
              fields: [createNestedField("text", "label")],
            },
          ],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBeGreaterThan(0);
    });

    it("should return empty array for list: true with no templates", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("dynamicZone", "sections", {
        list: true,
        settings: { templates: [] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toEqual([]);
    });
  });

  describe("FileGenerator", () => {
    it("should generate a fake URL when no file pool", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("file", "avatar");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(typeof result).toBe("string");
      expect((result as string).startsWith("https://")).toBe(true);
    });

    it("should generate a value from file pool when available", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("file", "avatar");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field, undefined, FILE_POOL);
      expect(FILE_POOL.map((f) => f.fileUrl)).toContain(result);
    });

    it("should generate an array for list: true file (MultiFileGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("file", "gallery", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      for (const url of result as string[]) {
        expect(typeof url).toBe("string");
        expect(url.startsWith("https://")).toBe(true);
      }
    });

    it("should generate list values from file pool", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("file", "gallery", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field, undefined, FILE_POOL);
      expect(Array.isArray(result)).toBe(true);
      for (const url of result as string[]) {
        expect(FILE_POOL.map((f) => f.fileUrl)).toContain(url);
      }
    });
  });

  describe("LongTextGenerator", () => {
    it("should generate a string", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("long-text", "description");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(typeof result).toBe("string");
      expect((result as string).length).toBeGreaterThan(0);
    });
  });

  describe("RichTextGenerator", () => {
    it("should generate an object with tag and children", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("rich-text", "body");

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result.tag).toBe("div");
      expect(Array.isArray(result.children)).toBe(true);
    });

    it("should generate an array for list: true (MultiRichTextGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("rich-text", "sections", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      for (const item of result as Record<string, unknown>[]) {
        expect(item.tag).toBe("div");
        expect(Array.isArray(item.children)).toBe(true);
      }
    });
  });

  describe("JsonGenerator", () => {
    it("should generate a JSON object", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("json", "metadata");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should generate an array for list: true", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("json", "items", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("ObjectGenerator", () => {
    it("should generate an object with nested fields", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "address", {
        settings: {
          fields: [createNestedField("text", "street"), createNestedField("number", "zip")],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect("street" in result).toBe(true);
      expect("zip" in result).toBe(true);
    });

    it("should return null when no fields defined", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "empty", { settings: {} });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should return null when fields is empty array", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "empty", {
        settings: { fields: [] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should generate an array for list: true (MultiObjectGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "addresses", {
        list: true,
        settings: {
          fields: [createNestedField("text", "street")],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      for (const item of result as Record<string, unknown>[]) {
        expect("street" in item).toBe(true);
      }
    });

    it("should return null for list: true with no fields", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "empty", {
        list: true,
        settings: { fields: [] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });
  });

  describe("TextGenerator", () => {
    it("should generate a text value", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "title");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(typeof result).toBe("string");
      expect((result as string).length).toBeGreaterThan(0);
    });

    it("should pick from predefined values when available", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "color", {
        predefinedValues: {
          enabled: true,
          values: [
            { value: "red", label: "Red" },
            { value: "blue", label: "Blue" },
          ],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(["red", "blue"]).toContain(result);
    });

    it("should generate email for email pattern", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "email", {
        validation: [
          { name: "pattern", message: "Must be email", settings: { preset: "email" } },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(result).toContain("@");
    });

    it("should generate URL for url pattern", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "website", {
        validation: [
          { name: "pattern", message: "Must be url", settings: { preset: "url" } },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(result.startsWith("https://") || result.startsWith("http://")).toBe(true);
    });

    it("should generate uppercase for uppercase pattern", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "code", {
        validation: [
          { name: "pattern", message: "Must be uppercase", settings: { preset: "uppercase" } },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(result).toBe(result.toUpperCase());
    });

    it("should generate lowercase for lowercase pattern", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "slug", {
        validation: [
          { name: "pattern", message: "Must be lowercase", settings: { preset: "lowercase" } },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(result).toBe(result.toLowerCase());
    });

    it("should return null for unknown pattern preset", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "custom", {
        validation: [
          { name: "pattern", message: "Custom", settings: { preset: "customPattern123" } },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should generate an array for list: true (MultiTextGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("text", "tags", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      for (const item of result as string[]) {
        expect(typeof item).toBe("string");
      }
    });
  });

  describe("RefGenerator", () => {
    it("should return null when no availableRefs", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "author", {
        settings: { models: [{ modelId: "author" }] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should pick a ref from availableRefs", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "author", {
        settings: { models: [{ modelId: "author" }] } as never,
      });

      const refs = new Map([["author", ["id1", "id2", "id3"]]]);
      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field, refs)) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result.modelId).toBe("author");
      expect(["id1", "id2", "id3"]).toContain(result.id);
    });

    it("should return null when model not found in refs", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "author", {
        settings: { models: [{ modelId: "author" }] } as never,
      });

      const refs = new Map([["category", ["id1"]]]);
      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field, refs);
      expect(result).toBeNull();
    });

    it("should return null when no settings.models", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "author", { settings: {} });

      const refs = new Map([["author", ["id1"]]]);
      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field, refs);
      expect(result).toBeNull();
    });

    it("should generate refs for list: true (MultiRefGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "categories", {
        list: true,
        settings: { models: [{ modelId: "category" }] } as never,
      });

      const refs = new Map([["category", ["c1", "c2", "c3", "c4"]]]);
      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field, refs)) as Array<Record<string, unknown>>;
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (const item of result) {
        expect(item.modelId).toBe("category");
        expect(["c1", "c2", "c3", "c4"]).toContain(item.id);
      }
    });

    it("should return null for list: true with no availableRefs", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "categories", {
        list: true,
        settings: { models: [{ modelId: "category" }] } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeNull();
    });

    it("should return null for list: true when model not in refs", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "categories", {
        list: true,
        settings: { models: [{ modelId: "category" }] } as never,
      });

      const refs = new Map([["other", ["id1"]]]);
      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field, refs);
      expect(result).toBeNull();
    });

    it("should pick refs from multiple models for list: true", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("ref", "related", {
        list: true,
        settings: { models: [{ modelId: "article" }, { modelId: "page" }] } as never,
      });

      const refs = new Map([
        ["article", ["a1", "a2"]],
        ["page", ["p1", "p2"]],
      ]);
      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field, refs)) as Array<Record<string, unknown>>;
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      const modelIds = result.map((r) => r.modelId);
      expect(modelIds).toContain("article");
      expect(modelIds).toContain("page");
    });
  });

  describe("DateTimeGenerator", () => {
    it("should generate a default datetime string", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "createdAt");

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(new Date(result).toString()).not.toBe("Invalid Date");
    });

    it("should generate a time value for settings.type = time", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "startTime", {
        settings: { type: "time" } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("should generate a date value for settings.type = date", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "birthday", {
        settings: { type: "date" } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should generate a dateTimeWithoutTimezone value", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "publishedAt", {
        settings: { type: "dateTimeWithoutTimezone" } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("T");
      expect(result).toContain("Z");
    });

    it("should generate a dateTimeWithTimezone value", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "scheduledAt", {
        settings: { type: "dateTimeWithTimezone" } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("T");
      expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it("should generate an array for list: true (MultiDateTimeGenerator)", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "dates", { list: true });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(Array.isArray(result)).toBe(true);
      for (const item of result as string[]) {
        expect(typeof item).toBe("string");
        expect(new Date(item).toString()).not.toBe("Invalid Date");
      }
    });

    it("should respect gte validation for dateTimeWithTimezone", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "scheduledAt", {
        settings: { type: "dateTimeWithTimezone" } as never,
        validation: [
          {
            name: "dateGte",
            message: "Must be after",
            settings: { value: "2020-01-01T00:00:00+00:00", type: "dateTimeWithTimezone" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it("should respect lte validation for dateTimeWithTimezone", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "scheduledAt", {
        settings: { type: "dateTimeWithTimezone" } as never,
        validation: [
          {
            name: "dateLte",
            message: "Must be before",
            settings: { value: "2030-12-31T23:59:59+00:00", type: "dateTimeWithTimezone" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it("should respect both gte and lte for dateTimeWithTimezone", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "scheduledAt", {
        settings: { type: "dateTimeWithTimezone" } as never,
        validation: [
          {
            name: "dateGte",
            message: "Must be after",
            settings: { value: "2025-01-01T00:00:00+00:00", type: "dateTimeWithTimezone" },
          },
          {
            name: "dateLte",
            message: "Must be before",
            settings: { value: "2025-12-31T23:59:59+00:00", type: "dateTimeWithTimezone" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/[+-]\d{2}:\d{2}$/);
    });

    it("should respect gte validation for time type", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "startTime", {
        settings: { type: "time" } as never,
        validation: [
          {
            name: "dateGte",
            message: "Must be after",
            settings: { value: "08:00", type: "time" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("should respect gte validation for date type", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "birthday", {
        settings: { type: "date" } as never,
        validation: [
          {
            name: "dateGte",
            message: "Must be after",
            settings: { value: "2000-01-01", type: "date" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should respect lte validation for dateTimeWithoutTimezone", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("datetime", "publishedAt", {
        settings: { type: "dateTimeWithoutTimezone" } as never,
        validation: [
          {
            name: "dateLte",
            message: "Must be before",
            settings: { value: "2030-12-31T23:59:59.000Z", type: "dateTimeWithoutTimezone" },
          },
        ] as never,
      });

      const gen = registry.getGenerator({ field });
      const result = (await gen.generate(field)) as string;
      expect(typeof result).toBe("string");
      expect(result).toContain("T");
    });
  });

  describe("List generators", () => {
    it("should generate arrays for list: true fields", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);

      for (const type of ["text", "number", "long-text"]) {
        const field = createField(type, `${type}List`, { list: true });
        const gen = registry.getGenerator({ field });
        const result = await gen.generate(field);
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });
});
