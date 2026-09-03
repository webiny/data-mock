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
              fields: [
                {
                  id: "title",
                  fieldId: "title",
                  storageId: "title",
                  type: "text",
                  list: false,
                  settings: {},
                  predefinedValues: { enabled: false, values: [] },
                  validation: [],
                  listValidation: [],
                },
              ],
            },
          ],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeDefined();
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
      const result = await gen.generate(field, undefined, [
        {
          id: "f1",
          projectId: "p1",
          tenant: "root",
          fileKey: "key1",
          fileUrl: "https://example.com/file.png",
          fileName: "file.png",
          fileType: "image/png",
          fileSize: 1024,
          uploadedAt: Date.now(),
        },
      ]);
      expect(result).toBe("https://example.com/file.png");
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
    it("should generate an array of lexical nodes", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("rich-text", "body");

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeDefined();
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
  });

  describe("ObjectGenerator", () => {
    it("should generate an object with nested fields", async () => {
      const { container } = setup();
      const registry = container.resolve(GeneratorRegistry);
      const field = createField("object", "address", {
        settings: {
          fields: [
            {
              id: "street",
              fieldId: "street",
              storageId: "street",
              type: "text",
              list: false,
              settings: {},
              predefinedValues: { enabled: false, values: [] },
              validation: [],
              listValidation: [],
            },
          ],
        } as never,
      });

      const gen = registry.getGenerator({ field });
      const result = await gen.generate(field);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
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
